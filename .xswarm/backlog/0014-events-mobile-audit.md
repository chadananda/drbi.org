---
id: "0014"
title: Events listing — mobile audit
state: active
priority: P1
size: S
acceptance:
  - text: ticket prices are fully visible at 320px and up
  - text: date, venue and description are visually separated, not concatenated
  - text: body text is readable without being oversized on a phone
  - text: the listing carries a ticket link (0005)
---

## Source
Chad, 2026-09-08, with a screenshot from a phone.

## 1. Prices clipped — FIXED 2026-09-08
`.ticket-prices { min-width: 260px }` with **no mobile override**. The 768px and
640px media queries touch `.events-list-full`, `.list-full-wrapper` and a
font-size, but never this rule. On a 390px viewport the icon, padding and a
`gap: 1.5rem` between label and amount push the row past the card's
`overflow-hidden` edge, so `$450 / $300 / $200` rendered as **"$4", "$3", "$2"**.

Flex children also default to `min-width: auto`, which prevented the long label
("Full Program — Minor (under 18)") from shrinking. Both reset in a 640px query.
Build verified.

**Why this one mattered most:** the price is the conversion information. A
listing that shows "$4" is worse than one showing nothing.

## 2. Date, venue and description run together — OPEN
The card reads:

> "25, 2026 – Sunday morning January 3, 2027 Desert Rose Bahá'í Institute Join us
> over Christmas break as we re-explore…"

Three distinct fields concatenated with no separator or styling. This is a
markup/content problem, not responsiveness — the date range, the venue and the
description need to be distinct elements.

## 3. Body text oversized on mobile — OPEN
The description dominates the viewport; roughly six words per line on a phone.
Reduce the mobile size so the card shows its price and CTA without scrolling —
right now a visitor scrolls past the description to reach the thing that converts.

## 4. Still no ticket link — see 0005
Confirmed again in this screenshot. The listing shows prices and a "Registration"
heading with nothing to click. 0005 is `active`; it is the last step before
payment and should land in the same deploy as this fix.
