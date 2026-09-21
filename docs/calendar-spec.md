# DRBI Public Calendar — Spec (v1)

**Goal:** One public calendar that shows DRBI programs/events *and* facility availability, so visitors can see what's happening and book open dates, and the team can manage it all in one place.

## Views (responsive, big-picture-friendly)
Default is the **current week** (most relevant); the viewer can zoom out. Toggle order: **Week ▸ Month ▸ Year.**

| View | Purpose | Wide screens | Narrow screens |
|------|---------|--------------|----------------|
| **Week** (default) | What's on now | 7-day grid, time-of-day | Day-by-day **agenda list** |
| **Month** | Planning | Classic month grid; events as chips, reserved ranges as a band | Scrollable single-month grid |
| **Year** | Big picture / multi-year holds | 12 mini-months, each day shaded by state | Vertical scroll of month strips |

## Item states (one legend across all views)
- 🔵 **Event / program** — a public event; links to its detail page.
- 🟠 **DRBI reserved** — DRBI activities and manually blocked date **ranges** (can be years out; render as one band, not many entries).
- 🟢 **Available** — any day not reserved or an event; links out to **Book on Airbnb**.

## Sources
1. **Events (automatic)** — the existing `events` table (Humanitix-synced + manual concert series/retreats). No re-entry; each links to its event page.
2. **Team-added calendar items (new)** — classes, study circles, Holy Days, reserved ranges, community dates. Each has an optional link to any page.
3. **Airbnb availability** — Phase 2 (see below).

## Booking / availability
- **Phase 1:** DRBI reserved ranges + events mark days "reserved"; every other day is "available → Book on Airbnb" (single listing URL setting).
- **Phase 2:** pull the Airbnb listing's **iCal feed** so real Airbnb bookings also show reserved — no double-booking. Same feed Danny & Flora manage.

## Admin (`/admin/calendar`)
Team members add/edit/delete calendar items and **select reserved date ranges**. Real events stay editable in `/admin/events` and appear read-only here (no duplication).

## Links
- "Full calendar" link from `/events` and `/facilities-and-rentals` → `/calendar`.
- Each calendar entry links to its page when one exists.

## Data model
New `calendar_items` table: `id, title, type (event|program|holyday|reserved), start, end, all_day, location, link_url, color, visible, created_by, notes`. Plus a small setting for the Airbnb listing URL (and later its iCal URL).

## Phasing
- **Phase 1:** three views + events + reserved ranges + "Book on Airbnb" link + admin editing + page links.
- **Phase 2:** Airbnb iCal sync for true availability; optional Bahá'í Holy Days seed; optional external Google/iCal feeds.

## Notes
- Custom, dependency-light, SSR-rendered calendar (keeps the Lighthouse-100 performance bar; no heavy calendar library). Minimal JS for view switching.
