---
id: "0005"
title: Ticket link on the events listing, not only the detail page
state: active
traces_to: .xswarm/GOAL.md
priority: P2
size: S
class: low
acceptance:
  - text: each event on /events offers a direct path to its tickets
  - text: prices shown on the listing sit beside a way to act on them
  - text: responsive sweep passes
    check: "pnpm test:e2e"
---

## Finding
The listing at /events shows prices — $340 adult, $200 minor — with no ticket
link. "Get tickets" appears only after clicking into the event. A visitor who
has already decided is made to navigate before they can act.

Small change, directly on the conversion path the site exists to serve.
