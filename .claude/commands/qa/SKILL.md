# QA — Full Project Quality Assurance

Run a comprehensive QA pass across the DRBI.org Astro site. Execute each phase sequentially, collect results, and produce a consolidated report.

## Phase 1: Dev Server

Start the Astro dev server and verify it responds.

```
1. Check if port 4321 is already in use: `lsof -ti:4321`
2. If not running, start dev server in background: `npm run dev &`
3. Wait for server to be ready (poll `curl -s -o /dev/null -w '%{http_code}' http://localhost:4321` until 200, max 60s)
4. Record: server status (up/down), startup time, any console warnings
```

## Phase 2: Existing Tests

Run all test suites and capture results.

```
1. Run Cucumber BDD tests: `npm run test:cucumber 2>&1`
   - Record: pass/fail count, failing scenario names
2. Run accessibility tests: `npm run test:a11y 2>&1`
   - Record: pass/fail, any violations
3. Run build integrity tests: `npm run test:full 2>&1`
   - Record: pass/fail, any errors
```

Report each suite's results separately. Do NOT stop on failure — run all suites.

## Phase 3: Visual Route Check (Chrome Screenshots)

Use Chrome browser automation to screenshot every public route. This verifies pages render without errors.

**Public routes to check:**

| Route | Description |
|-------|-------------|
| `/` | Homepage |
| `/about-us` | About page |
| `/working-with-us` | Partnership info |
| `/contact-us` | Contact page |
| `/how-to-purchase-a-plot` | Plot purchase info |
| `/events` | Events listing |
| `/topics` | Topics index |
| `/categories` | Categories index |
| `/authors` | Authors index |
| `/memorial` | Memorial posts |
| `/news` | News index |
| `/login` | Login page |
| `/404` | 404 page |
| `/admin` | Admin dashboard |

For each route:
1. Navigate to `http://localhost:4321{route}`
2. Wait for page load
3. Take a screenshot (save to `tmp/qa-screenshots/`)
4. Check for: visible error messages, blank pages, broken layouts, missing images
5. Read the browser console for JS errors (`mcp__claude-in-chrome__read_console_messages`)

Record: route, HTTP status, visual status (ok/broken), any JS console errors.

## Phase 4: Security Audit

```
1. Run `npm audit 2>&1` — capture vulnerability count by severity
2. Run `npm audit --json 2>&1 | head -100` — get structured data
3. Check for exposed secrets: grep for API keys, tokens, passwords in source files
   - Search patterns: `PRIVATE_KEY|SECRET|PASSWORD|API_KEY|TOKEN` in src/ (exclude node_modules, .env.example)
   - Flag any hardcoded credentials
```

Record: total vulnerabilities (critical/high/medium/low), any exposed secrets.

## Phase 5: Code Quality & Refactoring Candidates

Analyze the codebase for quality issues. Use file reads and grep — no external tools needed.

**Check for:**

1. **Large files (>300 lines):** Glob all `.astro`, `.ts`, `.js`, `.svelte` files in `src/`, check line counts. Flag files over 300 lines.

2. **Single-function files:** Files in `src/utils/` or `src/lib/` that export only one small function (<20 lines). These may be candidates for consolidation.

3. **Missing file headers:** Check if component files in `src/components/` have a comment or docstring at the top describing their purpose.

4. **Dead code indicators:**
   - Unused imports (files importing modules not referenced in the file body)
   - Commented-out code blocks (>5 consecutive commented lines)
   - Files not imported anywhere

5. **Code sprawl:** Files in project root that should be in `src/`, `scripts/`, or `tests/`.

6. **Dropbox conflict files:** Any files with "conflicted copy" in the name — these are Dropbox sync artifacts and should be cleaned up.

Record each finding with file path and specific issue.

## Report Format

After all phases complete, output a consolidated report:

```markdown
# QA Report — DRBI.org
**Date:** {date}
**Branch:** {current git branch}

## Summary
| Phase | Status | Issues |
|-------|--------|--------|
| Dev Server | {pass/fail} | {count} |
| Tests | {pass/fail} | {count} |
| Visual Check | {pass/fail} | {count} |
| Security | {pass/fail} | {count} |
| Code Quality | {info} | {count} |

## Phase Details
{detailed findings per phase}

## Priority Actions
{top 5 items to fix, ranked by severity}
```

Save the full report to `tmp/qa-report.md`.

## Loop Support

When run via `/loop`, maintain state at `tmp/qa-state.md` per the loop state file convention. On subsequent ticks, skip phases that passed on the previous tick and re-check only failures and code quality.
