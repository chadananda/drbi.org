# Sponsor-a-youth program

Lets supporters fund a young person's participation. Two pieces: **console setup** (Humanitix,
done via the `humanitix-events` skill — the API can't create donations/tickets) and the
**follow-up email engine** (built here).

## What's built (our side) ✅
- `POST /api/cron/sponsor-invites` (Bearer `CRON_SECRET`) — for each synced Humanitix event,
  emails registrants who signed up **≥2 days ago** and **haven't donated/sponsored**, **once each**
  (deduped via the `sponsor_invites` D1 table). Cap 200/run. 503 until `HUMANITIX_API_KEY` is set.
- Email includes the DGR receipt language + FEIN and links to the sponsor donation.
- Detection: an order with a donation (`clientDonation > 0`) counts as already-sponsored.
- Runs on the Humanitix GitHub Action schedule (every 6h).
- Sponsor link precedence: the `SPONSOR_DONATION_URL` Worker secret (a standalone donation page,
  see below) if set, otherwise the event's own Humanitix page.

## Console setup (Humanitix — via the humanitix-events skill, needs login) ⏳
1. **Per-event "Sponsor a youth" donation** at checkout (recommended over a ticket type — a
   donation has no per-ticket questions, so no housing/food questions to scope out). Suggested
   amount = youth rate (e.g. **$170**). 100% tax-deductible (donor receives nothing).
2. **Standalone donation page** ("Sponsor a Youth at Desert Rose") for the **mailing-list share
   link** — one persistent URL you can blast to the list. Set that URL as the Worker secret
   `SPONSOR_DONATION_URL` so both the follow-up email and any on-site button point at it.
3. **Complimentary tickets** — issue free tickets to the actual youth being sponsored, funded by
   the pool collected above.
4. **DGR receipts** — in each event's payment settings, set Charity = Desert Rose Bahá'í Institute,
   Tax ID = **86-0916677**, and use: *"No goods or services were provided in exchange for your
   contribution. All donations to Desert Rose Bahá'í Institute [FEIN: 86-0916677], a 501(c)(3)
   not-for-profit organization, are tax deductible to the full extent of the law."* For paid
   program tickets the deductible split is ~0% (attendees receive full value) — keep deductibility
   on the donation, not the ticket. Confirm the numbers with DRBI's accountant.

## Activation checklist
- [ ] Set up the per-event sponsor donation + standalone donation page (console).
- [ ] `wrangler secret put SPONSOR_DONATION_URL` = the donation-page URL.
- [ ] Confirm the follow-up looks right once a real order exists (verify order shape / donation
      detection against one live registration — the code is defensive but unverified against real data).
- [ ] Optional: a webhook for real-time instead of the 6-hour poll.
