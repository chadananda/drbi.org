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

## Assets
Source is the full-size PDFs in `tmp/flyer/` (flyer 3.2MB, header 4.5MB, rose
and music logo 2.1MB). House rule: R2 + ImageKit with responsive srcset. Never
the 78–130KB PNGs from the email, and never a raw file from `public/`.

## Blocked on
0011 — the per-concert details. The request has been drafted; it asks for date,
performer, instrument, programme, bio and photo per concert, plus whether
"First Sunday" means every month or selected months.
