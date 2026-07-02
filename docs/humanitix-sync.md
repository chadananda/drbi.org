# Humanitix event sync

Read-only sync of Humanitix events into the D1 `events` table. **It never publishes** —
synced events land as DRAFT (`visible = 0`) and a human publishes them from the admin
(Events → Show/Hide). Rows a human has edited in the admin are never overwritten by a sync.

## Pieces

| File | Role |
|------|------|
| `src/lib/humanitix.js` | API client + `mapHumanitixEvent()` (pure, unit-tested) |
| `src/lib/queries.ts` → `upsertSyncedEvent()` | Upsert; DRAFT on insert, preserves visibility + manual edits |
| `src/pages/api/cron/sync-events.ts` | Secured endpoint (`Bearer CRON_SECRET`); returns 503 until configured |
| `.github/workflows/sync-humanitix-events.yml` | Scheduler — pings the endpoint every 6h |
| `tests/unit/humanitix.test.js` | Mapper + fetch/pagination tests |

## Activation (two secrets + one repo secret)

1. **Humanitix API key** — Humanitix console → *Account → API keys*. Then:
   ```bash
   wrangler secret put HUMANITIX_API_KEY
   ```
2. **Shared cron secret** — pick a long random string. Set it on the Worker:
   ```bash
   wrangler secret put CRON_SECRET
   ```
   …and as a GitHub Actions repo secret named `CRON_SECRET` (Settings → Secrets → Actions)
   with the **same value**, so the workflow can authenticate.

Until `HUMANITIX_API_KEY` is set the endpoint returns `503 {"configured": false}` (the
scheduled workflow treats that as non-fatal, so it won't spam failures before setup).

## Run it manually

```bash
curl -X POST https://drbi.org/api/cron/sync-events \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json"   # required — Astro CSRF rejects form-type POSTs
# → {"ok":true,"configured":true,"created":N,"updated":N,"skippedManual":N,"total":N}
```

Or trigger the GitHub Action from the Actions tab (`workflow_dispatch`).

## Behavior guarantees

- **Never publishes.** New rows: `visible = 0`. Existing rows: visibility left as-is.
- **Never clobbers human edits.** If `manually_edited = 1`, only `last_synced` is touched.
- **Idempotent.** Keyed on `id = event-hx-<humanitixId>` (`source = 'humanitix'`,
  `external_id = <humanitixId>`); re-runs update in place.

See memory `humanitix-drbi-events` for the standing never-publish rule and current event IDs.
An alternative to the GitHub Action is a small Cloudflare Cron Trigger worker that POSTs the
same endpoint — kept out of the Astro worker because the CF adapter doesn't expose `scheduled()`.
