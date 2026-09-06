---
id: "0004"
title: Measure event registrations from Humanitix
state: ready
traces_to: .xswarm/GOAL.md
priority: P1
size: S
class: low
acceptance:
  - text: registrations per event are readable from the Humanitix API
  - text: the number appears on the standup board as drbi.org's valued action
  - text: it distinguishes ticket tiers — adult and minor sell differently
  - text: no credential is committed to the repository
---

## Problem
DRBI drives event registrations and they run through Humanitix, so the number
exists and nobody is reading it. Without it, drbi.org shows traffic and no
conversion — the leading indicator with nothing to lead to.

## Note
better-company.org already holds a `HUMANITIX_API_KEY` for the summit. If both
sit under one Humanitix organisation the same credential may serve; if not,
DRBI needs its own. Check before assuming.
