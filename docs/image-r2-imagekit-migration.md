# Static Image Migration → R2 + ImageKit

**Status:** ✅ DONE — executed & deployed to prod 2026-07-17 (worker version 659f08ad).
All 45 unique images uploaded to `drbi.org/site/…`; every import-based page now
serves via ImageKit (`CdnImage.astro`), zero `/_image` in page HTML. Orphaned source
files deleted. NOT migrated (out of scope — use markdown `![](./file)`, not ESM
imports): `src/pages/history/*` and `src/pages/agriculture/*` content-page images;
home hero poster/mp4 in `public/`; `public/drbi-landscape.webp` (path-referenced).
**Author:** Claude (Opus 4.8), 2026-07-12
**Goal:** Move the site's bundled static images off Astro's build-time `astro:assets`
pipeline (which serves through the in-worker `/_image` endpoint) onto R2 + the ImageKit
resize/cache service — the same pipeline the event images already use.

---

## Why

- **Consistency.** Event images (`HomeFeaturedEvents`, `EventCalendar`) already serve from
  R2 via `imagekitUrl()`. Static page images are the only holdouts still using `<Image>` /
  bundled imports → the `/_image` worker endpoint.
- **Offload the worker.** `/_image` runs image transforms *inside the Worker* on every
  cache-miss. R2 + ImageKit moves that to a purpose-built CDN (ImageKit origin =
  `cdn.shrtr.com`), with `f-auto` format negotiation and edge caching.
- **Removes a whole class of caching bugs.** The recent "radio image on the cemetery page"
  mixup was the middleware edge-cache colliding on the shared `/_image` key. That specific
  bug is already fixed (path-prefix `/_` now bypasses the edge cache), but eliminating
  `/_image` for static images removes the surface entirely.
- **Editability.** Images on R2 can be swapped without a rebuild/redeploy.

## Current state (scope)

135 bundled image imports across 19 files. Distribution:

| Count | File | Notes |
|------:|------|-------|
| 49 | `src/pages/facilities-and-rentals.mdx` | inline content images |
| 18 | `src/pages/contribute.mdx` | inline content images |
| 16 | `src/layouts/MDLayout.astro` | shared MDX layout imagery |
| 14 | `src/pages/memories.astro` | gallery |
| 9 | `src/pages/working-with-us.astro` | volunteer portraits + hero |
| 6 | `src/pages/radio/index.mdx` | |
| 5 | `src/components/drbicategories.astro` | category cards (watercolor illustrations) |
| 3 | `src/pages/index.astro` | home feature images (`arts`/`study`/`soil`) |
| 3 | `src/components/feature-grid.astro` | |
| 2 | `src/components/article/topicFAQ.astro` | |
| 1 each | `topics/index`, `topics/[topic]`, `news/index`, `memorial/index`, `how-to-purchase-a-plot`, `contact-us`, `about-us` | **page heroes** (via `PageHero`) |

Notes:
- `src/components/_feature-alt.astro_` and `_core-mission.astro_` end in `_` → disabled/
  unused files; **skip**.
- The **home hero** (`superhero.astro`) uses static `public/drbi-hero-poster.webp` +
  `public/drbi-open_md.mp4`, NOT `/_image`. Not broken, not part of this. Optional to move
  the poster later for consistency; the mp4 stays in `public/` (or its own R2 key).
- 15 `<Image>` (astro:assets) usages; the rest are plain `<img src={importedVar}>`.

## Target architecture

**R2 key scheme** (bucket binding `R2` = `cdn-assets`, public origin `cdn.shrtr.com`):

```
drbi.org/site/<page-or-area>/<name>.<ext>
  e.g. drbi.org/site/heroes/volunteer-pavilion.webp
       drbi.org/site/heroes/cemetery-gravesites.jpg
       drbi.org/site/facilities/roundhouse.webp
       drbi.org/site/memories/rasmussen.webp
```

Rationale: namespaced under `drbi.org/site/` to sit alongside existing `drbi.org/…` event
assets without collision; grouped by area for browsability in the R2 dashboard.

**Serving** — reuse the existing helper verbatim:

```js
import { imagekitUrl } from '@utils/utils.js';
// hero (face-cropped banner)
imagekitUrl('https://cdn.shrtr.com/drbi.org/site/heroes/volunteer-pavilion.webp',
            { w: 1600, h: 800, face: true });
// → https://ik.imagekit.io/1260/cdn/drbi.org/site/heroes/volunteer-pavilion.webp?tr=f-auto,q-80,w-1600,h-800,fo-face,c-maintain_ratio
```

**Proposed thin wrapper component** `src/components/CdnImage.astro` so pages don't hand-write
`imagekitUrl(...)` + `<img>` boilerplate and we get consistent lazy/decoding/dimension attrs
and optional `srcset`:

```astro
---
import { imagekitUrl } from '@utils/utils.js';
const { src, alt = '', w = 0, h = 0, face = false, class: cls = '',
        loading = 'lazy', sizes = '' } = Astro.props;
const base = src.startsWith('http') ? src : `https://cdn.shrtr.com/${src}`;
const one = (width) => imagekitUrl(base, { w: width, h: h && w ? Math.round(h * width / w) : h, face });
const srcset = w ? [w, w*2].map(x => `${one(x)} ${x}w`).join(', ') : '';
---
<img src={imagekitUrl(base, { w, h, face })} srcset={srcset} sizes={sizes}
     alt={alt} width={w||undefined} height={h||undefined}
     loading={loading} decoding="async" class={cls} />
```

- Heroes use `loading="eager"` + `fetchpriority="high"` (fixes an existing LCP nit — the
  current `PageHero` heroes are `loading="lazy"`).
- `PageHero.astro` changes its `<Image>` to `<CdnImage>`; the `image` prop becomes an R2 key
  string instead of a bundled import.

## Upload approach

A one-time script, `scripts/upload-images-r2.sh`, mapping each current bundled asset →
target R2 key and pushing with wrangler (uses the account's R2 creds, no AWS keys):

```bash
wrangler r2 object put cdn-assets/drbi.org/site/heroes/volunteer-pavilion.webp \
  --file=src/pages/history/_pavilion.webp --content-type=image/webp --remote
```

A manifest (`scripts/image-r2-manifest.tsv`: `sourcePath  r2Key`) drives the loop and doubles
as the find/replace map for the code edits. ~130 objects, a few MB total.

## Execution steps

1. **Build the manifest** — enumerate all 135 imports, assign clean R2 keys, sanity-check for
   name collisions. Deliverable: `scripts/image-r2-manifest.tsv`.
2. **Upload** to R2 (`--remote`), verify each `https://cdn.shrtr.com/<key>` returns 200 +
   correct `content-type`, and that `imagekitUrl(...)` transforms resolve 200.
3. **Add** `src/components/CdnImage.astro`.
4. **Migrate heroes first** (`PageHero.astro` + the 7 hero pages + `working-with-us`) — small,
   high-visibility, easy to verify. Ship.
5. **Migrate galleries/content** (`memories`, `facilities-and-rentals`, `contribute`,
   `radio`, `MDLayout`, `drbicategories`, `feature-grid`, `index`, `topicFAQ`). MDX `<img>`/
   `![]()` become CDN URLs or `<CdnImage>`.
6. **Delete** the now-unused bundled files from `src/` (git is the backup) once every
   reference is gone and a full `grep` confirms no bundled image imports remain.
7. **Verify**: build, `wrangler dev` local pass, visual pass on every touched page, deploy,
   prod spot-check. Confirm zero `/_image?` requests remain in page HTML.

## Risks / decisions to confirm

- **`fo-face` on non-portrait heroes** can crop oddly (e.g. landscape cemetery). Heroes may
  want `face: false` with a fixed focal point, decided per-image during step 4.
- **ImageKit account limits** — 130 new source images + transforms. Assumed within the
  existing `ik.imagekit.io/1260` plan already serving event images; worth a glance at usage.
- **MDX images** (`facilities`, `contribute`, `radio`) — 73 of the 135. Bulk of the work.
  Decide: full `<CdnImage>` conversion vs. simplest `![alt](https://ik.imagekit.io/…)` markdown.
- **No build-time optimization fallback** — if ImageKit/CDN is down, images 404 (today they're
  bundled and always present). Acceptable given events already depend on the same origin.
- **Home hero poster** — leave in `public/` (LCP-critical, preloaded) or move to R2? Recommend
  leave; revisit separately.

## Estimated effort

- Heroes-only (steps 1–4, ~12 images/8 files): ~1 focused session.
- Full sweep (all 135): ~2–3 sessions, MDX content being the long pole.

---

### Already shipped (context — not part of this plan)
- Hero "black box → soft blurry text-shadow" restyle (home + `PageHero` + volunteer).
- Distinct hero images for volunteer (`_pavilion`) and plot (`_gravesites`) pages.
- **Edge-cache collision fix** in `src/middleware.ts`: `/_` paths (incl. `/_image`) bypass the
  path-keyed edge cache. This is what actually stopped the image mixup. Deployed 2026-07-12,
  version `46da6d24`.
