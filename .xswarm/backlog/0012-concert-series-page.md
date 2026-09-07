---
id: "0012"
title: Concert series page plus an individual post per concert
state: ready
priority: P1
size: M
depends_on: ["0011"]
acceptance:
  - text: a series page exists at /events with the cadence, venue, time and free admission stated
  - text: each confirmed concert has its own page, shareable and individually findable
  - text: concerts publish as they are confirmed — the page never waits on a complete season
  - text: assets come from R2 via ImageKit, derived from the full-size PDFs, never the emailed PNGs
  - text: local SEO basics are present — Event structured data, venue address, free admission
  - text: each concert takes RSVPs and captures an email address, with consent to be contacted about future events
  - text: RSVP is OPTIONAL and never reads as a requirement — the event stays free and open
  - text: expected attendance per concert is visible without opening another system
---

## Shape
Chad, 2026-09-07: "We could create a page for this event series, but we need to
respond and ask for details about each specific event that is currently planned
so we can put together event posts for each."

Two levels, deliberately:

* **Series page** — what the First Sunday Concert Series IS. Cadence, Hakim Hall,
  3:00 PM, free, the Meet-the-Artists reception, the two historic pianos, the
  Sears founding. This page is stable across the season.
* **One post per concert** — date, performer, instrument, programme, bio, photo.
  Individually shareable and individually findable, which is the point: a person
  searching "piano concert Casa Grande" should land on a concert, not a series.

## Publish incrementally
Concerts go up as they are confirmed. **The page must never block on a complete
season** — three confirmed dates published beat a full season unpublished, and
waiting for completeness is how event pages miss their own events.

## Why this one earns its own page structure
It is the only FREE, RECURRING, LOCAL event DRBI runs. Riazati, the
Dawn-Breakers Challenge and Bayat are paid, singular, destination programmes.
A free monthly concert is the cheapest way for a local person to set foot on the
property — so it is the top of the local funnel and deserves real local SEO:
Event structured data, venue address, explicit free admission, and a page per
date that can rank on its own.

## RSVP — this is what makes the series strategically valuable
Chad, 2026-09-07: "The events can be RSVP so we can track people planning to
come. Try to collect email addresses of participants so we can create an event
page for each."

A free monthly concert is the cheapest way to meet local people. Without RSVP it
produces an afternoon; with RSVP it produces **a local list that compounds across
the season** — and that list is what the paid programmes (Riazati, the
Dawn-Breakers Challenge, Bayat) currently have no local source for.

### Use Humanitix, with free tickets
Not a bespoke form. Reasons:
* It is already the registration system for the paid events, so 0004's
  registration measurement covers concerts too — one dashboard, one number.
* It handles capacity and the automatic waitlist the August board report asked
  for. Hakim Hall is an intimate room; a popular artist can fill it.
* Emails arrive with consent attached, which a scraped form does not give.

### ⚠ RSVP must not read as a requirement
The flyer says **"Free & Open to Everyone"** and that promise must survive.
Frame it as help, not a gate: *"Let us know you're coming so we can set out
enough chairs."* Walk-ins stay welcome and the page should say so explicitly.

An optional RSVP on a free event typically captures a minority of attendees —
that is fine. The list is a by-product; filling the room is the goal, and
inverting those two would cost attendance to gain addresses.

### What to capture
Name, email, number of seats. Nothing more — every extra field costs
completions. Consent to hear about future Desert Rose events should be a clear,
separately-stated opt-in, because that permission is the whole point.

## Assets
Source is the full-size PDFs in `tmp/flyer/` (flyer 3.2MB, header 4.5MB, rose
and music logo 2.1MB). House rule: R2 + ImageKit with responsive srcset. Never
the 78–130KB PNGs from the email, and never a raw file from `public/`.

## Blocked on
0011 — the per-concert details. The request has been drafted; it asks for date,
performer, instrument, programme, bio and photo per concert, plus whether
"First Sunday" means every month or selected months.
