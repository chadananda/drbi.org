# Contributing to drbi.org

drbi.org runs on Astro 7 (SSR) + Cloudflare Workers, with content in D1 (`drbi-db`) and assets in
R2. You can develop and ship **without any Cloudflare account or keys** — you only need Git and Node.

## Deploying

**Push to `main` → the site deploys.** Cloudflare Workers Builds watches the repo, runs the build,
and deploys on Cloudflare's own infrastructure. No wrangler login, no API tokens, nothing to install
for deploys. Just:

```bash
git clone git@github.com:chadananda/drbi.org.git
# make your change on a branch, open a PR or push to main
```

`main` is production (custom domain drbi.org). Unit tests run as part of the build. There is no
separate staging, so keep `main` shippable.

## Local development

```bash
npm install
cp .dev.vars.example .dev.vars     # then fill in the auth + dev-seed values (see below)
npm run dev                        # http://localhost:4314
```

`npm run dev` auto-seeds your **local** database on first run (and refreshes it if it's >24h old),
so you get a populated site — real articles, events, and team, with all personal data stripped out.
Images load from the live CDN, so the site looks real locally.

### Getting local data

Local data comes from the live site over an authenticated endpoint — no Cloudflare access needed:

1. Ask an admin to mint you a token: `node scripts/mint-dev-token.mjs "Your Name"`.
2. Put it in `.dev.vars` as `DRBI_DEV_TOKEN=...`.
3. `npm run dev` (auto) or `npm run db:pull` (manual) loads a **sanitized** snapshot into your
   local Miniflare D1. It's read-only in effect — local edits never reach production.

Without a token the app still boots; the database is just empty until you pull.

| Command | What it does |
|---|---|
| `npm run dev` | Runs the app; auto-seeds local D1 on first run. |
| `npm run db:local` | (Re)apply schema + migrations to local D1 only. Offline, no keys. |
| `npm run db:pull` | Pull the sanitized data snapshot into local D1 (needs `DRBI_DEV_TOKEN`). |

## Content editing

Content is edited **live** in the admin UI (`/admin`) or via the internal API — it writes straight
to D1 and is live immediately, **no redeploy**. Don't add a build step that ingests content from
files into the main tables; that would clobber live admin/API/Humanitix edits.

## Tests

```bash
npm run test:unit        # fast, hermetic (node:test)
npm run predeploy:test   # unit + BDD smoke/critical gate
```
