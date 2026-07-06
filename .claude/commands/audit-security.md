---
description: Security audit — report only, no fixes
---
Security audit. REPORT ONLY — make no code changes.

Check: leaked secrets (grep src/; nothing baked in bundle — must read via getEnv/CF secret store, never import.meta.env), response headers `curl -sI https://drbi.org` (CSP, HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy), `npm audit`, input handling (D1 queries parameterized, no raw HTML/set:html sinks on user input), exposed bindings/env, auth guards on every /api/* and /admin/* route (whitelist role model).

Output ONE table: finding | area | severity | location.

End with: "Which severity first, why?"
