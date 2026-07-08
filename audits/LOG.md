# Audit & Maintenance Log

Append one row after any audit or maintain run.

| date | type | found | fixed | lines removed | notes |
| --- | --- | --- | --- | --- | --- |
| 2026-07-08 | a11y | color-contrast (structural a11y clean) | ~40 contrast fixes over 2 passes; homepage 20→6 | 0 | Residual: hero text-over-image + working-with-us muted text; ties into P7 palette |
| 2026-07-08 | perf | LCP-bound by video hero; TTFB variance | edge-cache all public pages, hero poster 152→39KB + preload, defer video, font preload, prefetch hover, lazy images | 0 | A11y/BP/SEO=100; Perf 82-94 lab (video hero), field-fast |
| 2026-07-08 | security | report-only CSP + set:html/API review | added HSTS/nosniff/frame/referrer/permissions headers + CSP-RO | 0 | set:html trusted; secrets clean |
| 2026-07-08 | seo | thin meta, sitemap gaps | titles/descriptions, JSON-LD, sitemap, robots.txt | 0 | SEO 100 |
| 2026-07-08 | usability | tap targets, forms, empty states | labels/autocomplete/aria-live, empty states, 404, external rel, mobile overflow | 0 | |
| 2026-07-08 | e2e | homepage event selectors stale after restyle | updated selectors + added 8 page-coverage features (pages-reachable crawl 30/30 green) | 0 | Lighthouse A11y/BP/SEO=100 across public site |
