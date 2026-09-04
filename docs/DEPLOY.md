# Deploying and publishing drbi.org

drbi.org is an Astro 7 SSR app running as a **Cloudflare Worker**, with D1 for
data, R2 for media, and KV for sessions.

Two paths reach production, and they are deliberately separate:

| Path | Who | Route | Needs |
|---|---|---|---|
| **Content** | Editors | Admin UI or the content API | An admin login, or an API token |
| **Code** | Developers | Pull request → merge to `main` | A GitHub account |

A content editor never touches infrastructure. A developer never touches
Cloudflare. Neither ever holds an R2, D1, or KV credential — those bindings stay
inside the Worker, where the platform hands them to the running code and nothing
can export them.

---

## Publishing content (no deploy required)

Content lives in D1 and is rendered server-side on every request, so **an edit is
live the moment it is saved**. There is no build step and no deploy in the loop.

Two ways in:

1. **The admin UI** at `/admin` — sign in with a magic link or Google.
2. **The content API** under `/api/admin/*`, for scripts and tooling.

### Content API

Authenticate with a bearer token:

```
curl https://drbi.org/api/admin/content?collection=news \
  -H "Authorization: Bearer drbi_…"
```

`X-API-Key: drbi_…` works identically.

| Endpoint | Methods | Minimum role |
|---|---|---|
| `/api/admin/content` | GET, POST | author / editor |
| `/api/admin/content/{id}` | GET, PATCH, DELETE | author / editor / admin |
| `/api/admin/team` and `/team/{id}` | GET, POST, PATCH, DELETE | author / editor / admin |
| `/api/admin/taxonomy/{categories\|topics}` | GET, POST | author / editor |
| `/api/admin/taxonomy/{kind}/{id}` | GET, PATCH, DELETE | author / editor / admin |
| `/api/admin/settings` | GET, PATCH, POST | editor / **admin** to write |
| `/api/admin/media/upload` | POST (multipart) | editor |
| `/api/admin/tokens` | GET, POST, DELETE | **superadmin** |
| `/api/events`, `/api/events/{id}` | GET, POST, PATCH, DELETE | editor |

Articles, news and memorial entries are all rows in `content`; select between
them with `?collection=`. Add `?draft=all` to include unpublished work.

Media upload takes a multipart `file`, checks the MIME type and a 15 MB ceiling,
writes to R2 **through the Worker binding**, records a row in `media`, and
returns the stored object including its key and URL:

```
curl -X POST https://drbi.org/api/admin/media/upload \
  -H "Authorization: Bearer drbi_…" \
  -F file=@photo.jpg
```

Writes accept only whitelisted fields, so a stray `id` or `created_at` in a
request body is ignored rather than applied.

### Tokens

Tokens are minted through `/api/admin/tokens` (superadmin only) and stored in
D1 as a **SHA-256 hash plus a public prefix — never the token itself**. The
plaintext is returned once, at creation, and cannot be recovered afterwards. Each
token carries its own role (`author` < `editor` < `admin` < `superadmin`), can
carry an expiry, and can be revoked individually without disturbing any other.

```
# mint
curl -X POST https://drbi.org/api/admin/tokens \
  -H "Authorization: Bearer <superadmin token>" \
  -H 'Content-Type: application/json' \
  -d '{"name":"Telahoun content tooling","role":"editor"}'

# revoke
curl -X DELETE "https://drbi.org/api/admin/tokens?id=<uuid>" \
  -H "Authorization: Bearer <superadmin token>"
```

Token traffic is rate limited to 120 requests/minute per token, in a shared D1
window, and answers 429 with `X-RateLimit-*` headers when exceeded. Signed-in
humans in the admin UI are never throttled. The limiter fails open: if D1
misbehaves, requests pass rather than taking publishing down.

An older single shared secret (`API_TOKEN`, a Worker secret) still grants
superadmin for backwards compatibility. Prefer per-person D1 tokens, and retire
that secret once nothing depends on it.

---

## Deploying code

Open a pull request. CI builds it, typechecks it, and runs the tests, and
**never deploys from a PR**. Merge to `main` and the same workflow deploys, then
polls `https://drbi.org/api/health` until it returns 200 — if health never comes
back green the run fails loudly, which is your signal to roll back.

Branch protection is what makes "merge, not push" real; see below.

To deploy by hand:

```
export CLOUDFLARE_ACCOUNT_ID=<account id>
npm ci && npm run build
npx wrangler deploy -c dist/server/wrangler.json
```

### Branch protection — set these in the GitHub UI

Under **Settings → Branches → Add branch ruleset** for `main`. These cannot be
configured from the repository, so they have to be switched on by hand:

- **Require a pull request before merging** — this is what stops a direct push
  to `main`. Without it, `git push origin main` still deploys.
- **Require status checks to pass** → select the **Build** check from the Deploy
  workflow. Also tick *Require branches to be up to date before merging*.
- **Do not allow bypassing the above settings**, so admins are held to it too.
- Optional but sensible: require one approving review, and **Require
  conversation resolution before merging**.
- Under **Settings → Actions → General**, leave *Require approval for all
  outside collaborators* enabled.

### Rolling back

Fastest, no rebuild:

```
npx wrangler deployments list --name drbi-preview
npx wrangler rollback --name drbi-preview        # or: rollback <version-id>
```

Rolling back the Worker does **not** roll back the database or any content. The
durable fix is to revert the commit and let CI redeploy:

```
git revert <sha> && git push origin main    # via a PR, if protection is on
```

---

## Secrets

### Repository secrets (GitHub → Settings → Secrets and variables → Actions)

| Secret | What it is |
|---|---|
| `CLOUDFLARE_API_TOKEN` | The scoped deploy token described below. |
| `CLOUDFLARE_ACCOUNT_ID` | The Cloudflare account id. Not really secret, but never hardcoded. |
| `CRON_SECRET` | Already present, for `sponsor-invites.yml`. Must match the Worker secret of the same name. |

### Cloudflare API token — exact permissions

Create at **My Profile → API Tokens → Create Token → Custom token**.

**Account permissions** (on *Chadananda@gmail.com's Account*):

| Permission | Level | Why |
|---|---|---|
| Workers Scripts | Edit | Upload and activate the Worker. The core one. |
| Account Settings | Read | Wrangler resolves the account before it can deploy. |

**Zone permissions** (on the `drbi.org` zone only):

| Permission | Level | Why |
|---|---|---|
| Workers Routes | Edit | `wrangler.jsonc` declares `drbi.org` and `www.drbi.org` as custom domains, and deploy reconciles them. |
| Zone | Read | Required alongside Workers Routes. |

**No R2. No D1. No KV.** The Worker reaches those through its bindings at
runtime; nothing in the deploy pipeline needs a credential for them, and none is
granted. This is much narrower than the older plan of handing CI an R2 token.

**One caveat, measured rather than assumed.** The build — not just the deploy —
currently opens a *remote binding session*, because the Worker declares an `ai`
binding and AI bindings always resolve remotely. Verified locally: remove the
`ai` binding and the build completes with no credentials at all; leave it in and
the build needs an authenticated account. So either

- **add Workers AI → Read** to the token (small, and still nothing like R2/D1/KV
  access), or
- stop the AI binding participating in the build, after which the token needs
  only the four rows above.

Start with the four rows. If the first run fails inside the remote binding
session, add Workers AI → Read.

### Worker secrets (separate; deploys never touch them)

14 secrets live on the Worker itself, in neither git nor GitHub:

```
CRON_SECRET               ELEVENLABS                GITHUB_PERSONAL_ACCESS_TOKEN
HUMANITIX_API_KEY         OPENAI                    PAYPAL_CLIENT_ID
PAYPAL_CLIENT_ID_SANDBOX  PAYPAL_SECRET             PAYPAL_SECRET_SANDBOX
PRIVATE_GITHUB_CLIENT_SECRET  PRIVATE_JWT_SECRET    SITE_ADMIN_EMAIL
SITE_ADMIN_PASS           ZEPTO_SEND_TOKEN
```

Manage with `npx wrangler secret put <NAME> --name drbi-preview`. Values are
**write-only** — Cloudflare will never show them again, and no tooling can read
them back. Keep the originals somewhere safe; the rename runbook explains why.
For local development put the same keys in `.dev.vars` (gitignored).

---

## What each person can and cannot do

**A content editor** (admin login, or an API token):

- Can publish, edit and unpublish content, upload media, manage team, tags and
  settings — all live, with no deploy
- Cannot deploy code, read Worker secrets, or reach Cloudflare at all

**A developer** (GitHub push access + the scoped token):

- Can ship code by opening a PR and merging it once checks pass; can roll back
- Cannot read or change the 14 Worker secrets (write-only, and out of token scope)
- Cannot touch other Workers, other D1 databases, or **any** R2 bucket via the
  deploy token — it has no storage permissions
- Cannot deploy from a pull request, or (with branch protection on) push to `main`

**The honest caveat:** a deploy token is only as contained as the Worker's
*bindings*. Whatever the Worker is bound to, deployed code can reach — so a
developer who can merge can, in principle, write code that reads the bucket the
Worker is bound to. That is why the bucket split below still matters as defence
in depth, even though it is no longer the blocker it once was.

---

## Database migrations

**Migrations are manual and deliberately excluded from CI.** Do not add a
`wrangler d1 migrations apply` step.

- Production has no `d1_migrations` tracking table; wrangler's migration system
  has never been used on `drbi-db` (the only migration tables are EmDash's own).
- The existing files are already applied in production.
- So a first `migrations apply` would create an empty tracking table and try to
  replay everything. `0001_add_sponsor_page_url.sql` would fail outright on
  `ALTER TABLE events ADD COLUMN` (duplicate column), and its `UPDATE`s would
  overwrite any sponsor URL since edited in admin.

Apply a new migration by hand and check the result:

```
npx wrangler d1 execute drbi-db --remote --file migrations/00NN_name.sql
```

Write them defensively — `CREATE TABLE IF NOT EXISTS`, no blanket `UPDATE`s over
editable columns — so this stays low risk. `0009_api_tokens.sql` (the content-API
tables) is already applied and is safe to re-run.

---

## Content that is *not* in D1 yet

Most content is D1-backed and therefore editable without a deploy: articles,
news, memorial entries, events, team, categories, topics, comments, media and
settings. Only `/contribute` is prerendered; everything else is SSR.

**These, however, are baked into the build and need a code change plus a deploy
to edit.** Nothing here has been migrated — this is a list, not a plan:

- **22 Markdown/MDX pages under `src/pages/`** — `history/` (7), `arts/` (4),
  `agriculture/` (3), `learning/`, `events/index`, `radio/index`,
  `facilities-and-rentals`, `the-bahai-faith`, plus `terms` and `privacy`.
  These are real editorial pages an editor would reasonably expect to change.
- **`src/data/site.json`** — imported by 37 files. Address, phone, email,
  branding, social handles. Changing the phone number today requires a deploy.
- **`src/data/siteLinks.json`** — site navigation.
- **Hardcoded copy inside `.astro` pages** — notably `about-us.astro`, which has
  board-member names, roles and biographies written directly into the template.

Migrating those into D1 would finish the "content never needs a deploy" promise.
It is a separate piece of work and wants Chad's call on scope.

Also worth knowing: `src/pages/memorial/index.astro` calls
`getCollection('memorial')`, but no file-backed collections remain
(`src/content.config.ts` keeps schemas for type reference only). Worth a look.

---

## R2: the dedicated bucket

**Done:** `drbi-assets` exists and holds a verified copy of everything that was
under `cdn-assets/drbi.org/` — 158 objects, ~56 MiB, with the redundant
`drbi.org/` prefix stripped (`drbi.org/events/x.jpg` → `events/x.jpg`). Every
object matches on size and ETag, and a sample across all five top-level prefixes
matches byte-for-byte by SHA-256, content types included. **Nothing was deleted
from `cdn-assets`; the originals are untouched and still serving.**

**Not switched over, deliberately.** The Worker still binds `cdn-assets`, because
the public image path runs through infrastructure this repo does not own:

```
ik.imagekit.io/1260/cdn/drbi.org/<key>   →   cdn.shrtr.com/drbi.org/<key>   →   R2 cdn-assets
```

`cdn.shrtr.com` is an R2 custom domain on **cdn-assets**, on the `shrtr.com`
zone, and ImageKit's origin points at it — an origin **shared with at least eight
other sites**. Flip only the binding and new uploads land in `drbi-assets` while
their URLs still resolve to `cdn-assets`, so every newly uploaded image 404s.
Repointing ImageKit would move all eight sites at once. Dropping ImageKit would
serve originals untransformed, including 3.4 MB hero images.

So the assets stay where they are until there is a working image path for the new
bucket. To finish it later:

1. Give `drbi-assets` a public domain on a zone drbi.org already owns:
   `npx wrangler r2 bucket domain add drbi-assets --domain cdn.drbi.org`
2. Decide the transform story for **drbi only** — a second ImageKit origin, or
   Cloudflare Images, or a transform Worker. Do not skip it; image weight
   regresses badly without one.
3. Update the URL layer: `img_base_url` in `src/data/site.json`, `imagekitUrl()`
   in `src/utils/utils.js` (it hardcodes `https://cdn.shrtr.com/` and
   `ik.imagekit.io/1260/cdn/`), the `IK` constant in
   `src/pages/admin/media/index.astro`, the `r2_key` prefix in
   `src/pages/api/admin/media/upload.js`, and the `img-src` CSP allowlist in
   `src/middleware.ts`. Keys lose the `drbi.org/` prefix.
4. Flip the binding in `wrangler.jsonc`, deploy, and verify both an existing
   image and a **fresh upload** through the admin media page.
5. Only once it has been solid in production should Chad delete the `drbi.org/`
   prefix from `cdn-assets`.

`scripts/r2-migrate/` holds the one-off Worker used for the copy, kept so the
verification can be re-run: `npx wrangler dev --remote` from that directory
exposes `/count`, `/copy`, `/verify`, `/keys` and `/sample`. It treats
`cdn-assets` as strictly read-only.

---

## Renaming the Worker (drbi-preview → drbi)

`drbi-preview` is a misleading name for the thing serving production, but the
rename is **not** a config edit:

- A renamed Worker is a **new** Worker with **zero secrets**, and the 14 values
  cannot be copied — Cloudflare never discloses them. They must be re-entered by
  hand. Moving the domain to a Worker missing them means broken auth, email,
  PayPal and Humanitix.
- `drbi.org` cannot be attached to two Workers at once, so the cutover is
  detach-then-attach, with a real if brief window of downtime.

Runbook, when the secret values are to hand:

1. Set `name` to `drbi` in `wrangler.jsonc` and **remove the `routes` block** so
   the first deploy cannot fight over the domain.
2. Deploy; confirm it serves on `drbi.<subdomain>.workers.dev`.
3. `npx wrangler secret put <NAME> --name drbi` for all 14.
4. In the dashboard, move `drbi.org` and `www.drbi.org` from `drbi-preview` to
   `drbi`. The dashboard keeps the window short and is easy to reverse.
5. Confirm `https://drbi.org/api/health` returns 200 and the site renders.
6. Restore the `routes` block so future deploys keep it.
7. Only then delete `drbi-preview`.

## Health endpoint

`GET /api/health` exercises the bindings rather than returning a constant: it
queries D1, lists R2 under the drbi prefix, and reads KV, returning 200 when all
three answer and 503 otherwise, with per-check timings. CI uses it as the
post-deploy gate.
