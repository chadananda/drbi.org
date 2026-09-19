# Converting the 37 `site.json` call sites to D1

`site_config` exists, is seeded, and has an accessor
(`src/lib/server/site-config.js`) behind `SITE_CONFIG_FROM_D1`, off by default.
Nothing reads it yet. This is the plan for the call sites — **not yet executed**,
because the right answer differs per site and several must never be converted.

The accessor is async (`await getSiteConfig()`), while `import site from
'@data/site.json'` is synchronous. That asymmetry is what makes this a per-site
judgement rather than a find-and-replace.

## Where the 37 live

| Area | Files | Verdict |
|---|---|---|
| `src/pages/admin/**` | 14 | Convert last, low value |
| `src/components/**` | 9 | Convert — but only via props |
| `src/pages/**` (public) | 6 | Convert first |
| `src/lib/**` | 3 | Case by case |
| `src/utils/**` | 2 | Do **not** convert wholesale |
| `src/pages/api/**` | 2 | Convert, easy |
| `src/layouts/**` | 1 | Convert first — highest leverage |
| `astro.config.js` | 1 | **Never convert** |
| `scripts/**` | 2 | **Never convert** |

Most-used keys, which is where the value is: `email` (11), `author` (11),
`url` (10), `siteName` (10), `phone` (8), `twitter` (7), `youtube` (5),
`address` (5).

## Must never be converted

- **`astro.config.js`** — `site: site.url` is read while Vite builds, long before
  any request exists and with no D1 binding available. It is also what
  `@astrojs/sitemap` and canonical URLs are derived from. It stays a static
  import, which makes `url` permanently build-time.
- **`scripts/**`** — plain node build tooling with no binding. Includes
  `ingest-site-content.mjs`, which *reads* site.json to produce the seed;
  pointing it at D1 would be circular.

## Do not convert wholesale

- **`src/utils/utils.js`** (imports at module scope, uses `site.url` in three
  helpers). These helpers are synchronous and called from many places including
  build-time paths. Making them async would ripple across the codebase for one
  key that is pinned to build time anyway (see `astro.config.js`). Leave the
  static import; if a specific helper ever needs live config, pass it in.

## Order of work

**1. `src/layouts/Layout.astro` (highest leverage).** Every public page renders
through it, and it emits the title, description, OG and canonical tags. Resolve
config once here and pass it down. One `await` covers the most visible surface.

**2. The 6 public pages** (`contact-us`, `about-us`, `contribute`, …). These are
SSR (`prerender = false`), so `await getSiteConfig()` in the frontmatter is
safe. `contact-us.astro` is the single best first candidate: it renders
`site.address`, `site.email` and `site.phone` — exactly the fields a non-technical
editor would want to change without a deploy.

**3. The 9 components.** Do **not** call the accessor inside components. Astro
components render synchronously within a page and a per-component D1 read would
multiply queries on a single page. Take config as a prop from the layout or page
that already resolved it. This is the step most likely to be got wrong by a
mechanical rewrite.

**4. The 2 API routes.** Trivial — already async, already request-scoped.

**5. `src/lib/**` (3).** Case by case. `auth.ts` uses `site.author` at *module
scope* to build a default identity object; that runs at import time, where no
binding exists. It needs restructuring to a lazy call, or should stay static.

**6. `src/pages/admin/**` (14).** Last. Admin is staff-only, a deploy to change
its chrome is acceptable, and the payoff is smallest.

## Rules for whoever does it

- Resolve config **once per request**, at the top of the layout or page, and pass
  it down. Never call the accessor inside a component or a loop.
- The static import stays the fallback everywhere — the accessor already
  guarantees it, and that is what makes the change safe to land dark.
- Convert and verify one area at a time with `SITE_CONFIG_FROM_D1` off, so the
  live output cannot change; the flag flip is a separate, later decision.
- `url` is effectively build-time. Do not present it as editable.
- After conversion, decide whether `/api/admin/settings` should expose
  `site_config` for editing — it currently reads the `options` table, which no
  longer receives `site.*`.

## Loose end

Production `options` still holds 30 stale `site.*` rows from the earlier seed.
Nothing reads them. They can be pruned once Chad is happy, but production data
deletion is his call, not something to fold into this work.
