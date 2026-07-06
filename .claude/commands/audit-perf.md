---
description: Performance audit — report only, no fixes
---
Performance audit. REPORT ONLY — make no code changes.

Run `npx lighthouse <url> --only-categories=performance --quiet` (mobile + desktop; /, /events). Check: bundle sizes in dist/, cache headers `curl -sI` on /_astro/* (immutable?), image sizing/format (R2 + ImageKit face-crop, right dimensions, webp/avif), CF Worker limits (CPU time, subrequests), render-blocking CSS/JS, font loading, LCP element.

Output ONE table: issue | metric | page | est. gain.

End with: "Which single fix wins biggest? Reasoning."
