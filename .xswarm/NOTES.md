# Operational notes

_Traps that cost time once and would cost it again._

Each entry carries a **disposition**: `irreducible` (external, cannot be fixed)
or `fixable -> NNNN` (an item exists; delete this note when it lands).

## `npm run dev` dies with no error unless CLOUDFLARE_ACCOUNT_ID is set

`wrangler.jsonc` declares an `ai` binding, and Workers AI has no local
emulation — so `astro dev` always opens a remote proxy session. The account has
two entries, wrangler will not choose one non-interactively, and Astro 7 runs
the dev server in a child process whose stderr it swallows. All you see is
`Dev server process exited before becoming ready.` The real error is in
`.astro/dev.log`. Workaround: `CLOUDFLARE_ACCOUNT_ID=<drbi account> npm run dev`.
Disposition: `fixable (no item yet)` — put `account_id` in `wrangler.jsonc`.

## `/events` 500s in local dev — the local D1 is empty

`platformProxy` serves D1 from `.wrangler/state/v3/d1/`, which starts with no
tables, so `getVisibleEvents()` throws `no such table: events`. Seed it with
`wrangler d1 execute drbi-db --local --file <sql>` over `src/lib/schema.sql`
plus `migrations/`. Note migrations 0002–0007 are not in this repo, so
`0011_seed_site_content.sql` fails on a missing `options` table until you
create it by hand (`name TEXT PRIMARY KEY, value TEXT`).
Disposition: `fixable (no item yet)` — a `db:seed:local` script would do it.

## Playwright's webServer waits on a port `npm run dev` never opens

`playwright.config.js` sets `baseURL`/`webServer.url` to `:4850`; `npm run dev`
and `astro.config.js` pin `:4314`. With no server already up, `npx playwright
test` starts dev on 4314 and then times out waiting on 4850.
Disposition: `fixable (no item yet)`.

## `test:e2e` cannot pass on Linux — the visual baselines are macOS-only

`tests/visual-regression.spec.js-snapshots/` holds only `*-chromium-darwin.png`.
Playwright looks for `*-chromium-linux.png`, finds nothing, writes the actual
and fails — 36 tests, every page, unrelated to whatever you changed. Do not
regenerate them from a dev server with seeded fixtures; that bakes fixture
content into the expected images. Needs a decision on where these run.
Disposition: `fixable (no item yet)` — Chad's call.

## Backlog acceptance checks say `pnpm`, this repo is npm

`package.json` sets `"packageManager": "npm@11.19.0"`, so `pnpm <script>` exits
with `This project is configured to use npm`. Any acceptance `check:` written
as `pnpm ...` fails before it runs anything. Use `npm run ...`.
Disposition: `fixable (no item yet)` — correct the checks as items are written.
