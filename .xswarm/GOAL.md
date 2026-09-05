<!-- PROPOSED by goal-propose.py. Inferred from repo evidence, not
     confirmed by Chad. Raise at the next planning meeting. -->

# Goal (PROPOSED)

## What this is for

DRBI is a physical retreat center with land, lodging, and a program calendar. The site's real job is not publishing — it is running the money and the logistics of that place. The users are two groups: (1) a very small staff (Chad, Telahoun, Wade, Bob Martin appears as a reviewer) who need to create an event, take registrations, issue an accommodation invoice, chase payment, and see who is actually coming; and (2) prospective attendees and donors who need to find a retreat, book a bed, pay, and give. The commit history is almost entirely about group 1 — invoices, registrant dedup, PayPal, per-event accommodation rates, login state — while the README is almost entirely about group 2. I am inferring that the goal follows the commits, not the README: **the site becomes the operational system of record for DRBI's events, bookings, and donations, so that staff stop running the retreat center out of spreadsheets, email threads, and manual PayPal requests.** The content site is the front door to that system, not the product.

## What success looks like

A retreat runs end to end without anyone leaving the site: the event exists, people register, accommodation is assigned and priced, an invoice goes out with the right dates and reference, payment is recorded, and the staff can answer "who is coming and who still owes us" from one screen. Donations arrive through the contribute page with fund attribution attached, not as unlabeled PayPal transfers someone reconciles later. The public content — categories, posts, in-memoriam, newsletter — exists and is maintained by a non-technical person through the admin, but it is no longer the thing that determines whether the site is working. The Events API and content API have at least one real consumer outside this codebase, or they should not exist.

## What would falsify this

Six months out, staff are still issuing invoices by hand — the invoice modal exists but the actual retreat bookings were reconciled in a spreadsheet or over email, and the D1 registrant table is thinner than the real attendee list. Concretely: pull the registrant/invoice rows for the next retreat that actually happens and compare the count to the sign-in sheet. If the site holds fewer than most of the real bookings, the operational-system premise is wrong and this is a brochure site with an admin panel bolted on.

A second falsifier: the tokened content API and Events API accumulate no external caller. That would mean the API work was architecture for its own sake, and the goal should be stated as "one good admin UI," not "a platform."

## Explicitly not the goal

Becoming a general-purpose booking or church-management product. The invoice picker, PayPal flow, and events CRUD are close enough to Breeze/Planning Center/Lodgify that the temptation is to generalize them. Don't — DRBI has one facility, a handful of event types, and about three staff. Generalizing multiplies the surface area without a second customer.

Also not the goal: the content migration as an end in itself. Migrating "as much content as possible" is README work; it matters only to the extent it feeds people into the registration and donation paths.

## Where I am guessing

- **That operations beat content.** If Chad says the actual priority is publishing DRBI's body of teaching and the events work was just a detour to pay for it, the whole goal inverts. This is the load-bearing guess.
- **Who the second user is.** I inferred Telahoun is a non-technical content editor who needs the admin CMS, from "add account for Telahoun" plus "begin migrate as much content as possible." Could equally be a co-developer. Changes whether admin UX is a priority or an afterthought.
- **That the APIs are for external consumers.** "Content API with D1-backed tokens + dedicated R2 bucket" and an OpenAPI spec suggest something outside is meant to read this. I have no idea what. If the answer is "nothing yet," the API is speculative and should be scoped down or named.
- **That registration lives on this site.** The `humanitix-events` skill is installed, which implies ticketing may actually run on Humanitix while this site only invoices for accommodation. If so, "system of record" is wrong — the site is a settlement layer on top of Humanitix, which is a materially different goal. **This is the guess most likely to be wrong.**
- **That there is a distinct project overlap here.** DRBI's site and the `build-new-site` standard stack (Astro + Worker + D1 + R2 + admin CMS + magic link) are the same shape. I suspect drbi.org is both a real site and the reference implementation of Chad's house stack. If that is true, some architecture decisions here are being made for the stack's benefit, not DRBI's, and the goal should say so out loud.
- **Weakest inference:** the deploy story. Two wranglers (`wrangler.jsonc`, `scripts/r2-migrate/wrangler.jsonc`) plus an earlier Vercel deploy suggests a half-finished platform migration. If Vercel is still live in front of any of this, the operational claims are shakier than they look.
