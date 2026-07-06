---
description: Accessibility audit — report only, no fixes
---
Accessibility audit. REPORT ONLY — make no code changes.

Tools: `npx pa11y <url>` and/or `npx @axe-core/cli <url>`. Target https://drbi.org (or local `astro dev` :4850). Cover /, /events, an article page, /contact.
Also check by hand: one h1 + no heading-level skips, img alt text, color contrast (WCAG AA), keyboard reachability + visible focus ring, ARIA roles/labels sane, form controls labeled.

Output ONE table: issue | wcag | page | severity.

End with: "Pick top 3, give me your fix plan."
