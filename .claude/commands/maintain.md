---
description: Cruft/maintenance audit — report + safe-delete list
---
Maintenance sweep. REPORT ONLY — delete nothing yet.

Scan src/, scripts/, public/, tests/ for: dead/unreachable code, commented-out blocks, duplication, unused deps (`npx depcheck`), stale TODO/FIXME, orphaned assets (public/ files nothing references), style violations, oversized functions, .gitignore gaps (tmp/, .dev.vars, dist/, .wrangler/).

Output ONE table: finding | type | location | lines saved.

End with: "Sort safe deletes vs discuss; I'll execute safe list."
