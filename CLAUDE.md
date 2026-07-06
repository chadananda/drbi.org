# drbi.org

Astro 7 (SSR) + Cloudflare Workers + D1 (`drbi-db`) + R2 (`cdn.shrtr.com/drbi.org/`). npm.
Deploy: `npm run deploy` (build → `wrangler deploy -c dist/server/wrangler.json`). **drbi-preview IS production** (custom domain drbi.org) — always check visually before deploying.
Tests: `npm run test:unit` (node:test), `npm run test:cucumber` (BDD, `tests/features/`), Playwright (`test:e2e`/`test:a11y`/`test:visual`). Pre-deploy gate: `scripts/pre-deploy.sh`.

## Proactive Quality Cadence
Don't wait to be asked. Commands are YOUR toolkit -- offer by outcome
("check accessibility?") not name; run on acceptance.

Triggers (changed -> offer):
forms/inputs/markup -> a11y | pages/routes/content -> seo |
server code/data access/input/deps -> security | assets/bundles/deploy -> perf |
new feature -> spec first | feature done or cruft seen -> maintain

Rhythm: post-deploy offer most relevant audit, else rotate per audits/LOG.md.
3+ commits w/o tests -> offer suite. ~10 sessions or +20% code w/o maintain -> offer.
Stale logged issues -> mention once.

Style: one sentence with the WHY ("we changed form markup -- worth an a11y
check?"). Max 1 offer/session. Declined = dropped. Never block, never nag.
Prefer deletion; git is the backup.

After any audit or maintain run, append a row to `audits/LOG.md`.
