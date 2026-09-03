# drbi.org — Website Progress Report

**Period:** Since the last board meeting (mid-July 2026 → August 15, 2026)
**Prepared for:** DRBI Board

Over the past month we made substantial improvements to the website in five areas: **event registration and management**, **accommodation invoicing**, **the donations page**, **site photography**, and **performance/behind-the-scenes infrastructure**. Highlights below.

---

## 1. Event Registration & Management (biggest push)

We built out a real back-office for running events, with Humanitix (our ticketing platform) as the single source of truth so staff never have to keep two systems in sync.

- **Admin event dashboard** — staff can see every event, its registration stats, and manage it in one place. Non-admin staff now have appropriate visibility too.
- **"Create Paid Event" shortcut** into Humanitix, so new events start the right way.
- **Human-controlled visibility** — an event only appears on the public site when we choose to show it, and only after it's actually published on Humanitix (prevents half-finished events leaking to the public).
- **Registrant roster, upgraded** — newest-first ordering, a phone-number column, a housing summary line (apartments / dorms / off-site), and a clean **print view** for check-in day.
- **Capacity + automatic waitlist** — each event can have a seat cap; once it fills, the public page automatically switches from "Get tickets" to a **waitlist sign-up form**, and waitlisted people are stored for us to follow up. (Built specifically because the Dawn-Breakers Challenge is filling up.)
- **Per-event email announcements** — we can now email all registrants of a given event (with a test-send-to-myself step first), for logistics and follow-up info.
- **Per-event coordination thread + AI meal summary** — an internal notes thread for staff, plus an automatic AI-generated summary of meal/dietary needs pulled from registrations.

## 2. Accommodation Invoicing (PayPal)

We can now bill guests for on-site accommodation directly from the admin, with proper record-keeping.

- **Send a PayPal invoice per registrant**, picked from a dropdown of that event's registered people (deduplicated by person).
- **Branded, professional invoices** carrying our rose + wordmark logo, with each invoice clearly tied to its specific event and dates.
- **Paid/unpaid status at a glance** — the event summary box shows how many invoices are out, how much has been paid, and how much is still due.

## 3. Donations / "Contribute" Page

A complete redesign and expansion, including feedback from Bob Martin.

- **New "desert dawn" editorial design** — a bespoke, more compelling look for the page.
- **Six giving funds** now offered (up from a handful), each with its own call to action; Firm Foundation moved to the bottom per the new priority order.
- **Implemented Bob Martin's suggestions** on layout and content.
- **Fixed a login bug** unique to this page and cleaned up a duplicate navigation button.

## 4. Site Photography

- **214 new stock/gallery photographs** added and organized, giving the site a much deeper, more professional image library to draw on across pages.

## 5. Performance & Infrastructure (invisible but important)

Work that keeps the site fast, cheap to run, and reliable.

- **Moved all site images to cloud storage (R2) + an image-optimizing CDN (ImageKit)** — faster loads, smaller pages, and images resized automatically per device.
- **Self-hosted fonts and non-blocking loading** so pages paint instantly.
- **Edge-caching** so pages are served near-instantly to visitors without re-rendering on every request.
- **Radio pages updated** to the KURE-LP 106.1 FM rebrand.
- **Responsive fixes across the entire admin** so it works cleanly on phones and tablets.
- **Automated test suite kept green** (fixed stale checks after the above changes).

---

## Bottom line

The site moved from "brochure that lists events" toward a **working operations platform**: we can create events, control what's public, manage registrants and housing, run an automatic waitlist, invoice for accommodation, email attendees, and accept donations across six funds — all while getting faster and cheaper to run.

*Report generated from the site's change history, July 17 – August 7, 2026.*
