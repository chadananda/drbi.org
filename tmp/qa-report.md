# QA Report — DRBI.org
**Date:** 2026-04-07
**Branch:** main

## Summary
| Phase | Status | Issues |
|-------|--------|--------|
| Dev Server | PASS | 0 |
| Tests | FAIL | Playwright browsers not installed |
| Visual Check | WARN | 2 issues |
| Security | WARN | 70 vulnerabilities |
| Code Quality | INFO | 48+ findings |

---

## Phase 1: Dev Server
**Status:** PASS

- Server started on port 4321 in ~3 seconds
- All 14 public routes return correct HTTP status codes
- No startup errors

| Route | HTTP Status | Notes |
|-------|-------------|-------|
| `/` | 200 | OK |
| `/about-us` | 200 | OK |
| `/working-with-us` | 200 | OK |
| `/contact-us` | 200 | OK |
| `/how-to-purchase-a-plot` | 200 | OK |
| `/events` | 200 | OK |
| `/topics` | 200 | OK |
| `/categories` | 200 | OK |
| `/authors` | 200 | OK |
| `/memorial` | 200 | OK |
| `/news` | 200 | OK |
| `/login` | 200 | OK |
| `/404` | 404 | Correct |
| `/admin` | 302 | Redirects to login (correct) |

---

## Phase 2: Existing Tests
**Status:** FAIL — Playwright browsers need reinstalling

### Cucumber BDD Tests
- **Result:** FAIL — browserType.launch error
- **Cause:** Playwright browser binaries missing (chromium_headless_shell-1200)
- **Fix:** Run npx playwright install

### Accessibility Tests (13 tests)
- **Result:** FAIL — Same Playwright browser issue
- **All 13 tests failed** due to missing browser, not actual a11y issues

### Build Integrity Tests
- **Result:** PARTIAL (5/8 passed, 3 failed)
- Build fails on Dropbox conflict files (conflicted copy of index.astro breaks module resolution)
- Missing dist/server/data/team.json during build
- Dev server test uses timeout command (not available on macOS)

---

## Phase 3: Visual Route Check
**Status:** WARN — 2 issues found

### Screenshots taken for all public routes via Chrome

| Route | Visual Status | Issues |
|-------|--------------|--------|
| `/` | WARN | Large blank area where hero video/image should be |
| `/about-us` | WARN | Blank space below header (missing image asset) |
| `/working-with-us` | OK | Renders correctly |
| `/contact-us` | OK | Form and contact info render correctly |
| `/events` | OK | Event cards render, blank space for calendar widget |
| `/topics` | OK | Topic links render correctly |
| `/categories` | OK | Category cards render |
| `/authors` | OK | Author cards render |
| `/memorial` | OK | Renders correctly |
| `/news` | OK | Renders correctly |
| `/login` | OK | Login form renders correctly |
| `/404` | OK | Returns 404 status correctly |
| `/admin` | OK | Redirects to login (correct behavior) |

### Page Title Bugs (FIXED)
The following pages had incorrect title tags — **fixed during this QA run:**

| Route | Before | After |
|-------|--------|-------|
| `/topics` | undefined | drbi.org | The Big Ideas | drbi.org |
| `/categories` | undefined | drbi.org | Site Categories | drbi.org |
| `/authors` | undefined | drbi.org | All Authors | drbi.org |
| `/authors/[author]` | undefined | drbi.org | {Author Name} | drbi.org |
| `/news` | Article | drbi.org | Desert Rose News | drbi.org |
| `/working-with-us` | About Us | drbi.org | Working with Us | drbi.org |

**Root cause:** Pages were passing pageTitle prop but Layout.astro expects title.

### Console Errors
No JavaScript console errors detected on any page.

---

## Phase 4: Security Audit
**Status:** WARN — 70 vulnerabilities

### npm audit Results
| Severity | Count |
|----------|-------|
| Critical | 1 |
| High | 35 |
| Moderate | 27 |
| Low | 7 |
| **Total** | **70** |

### Notable Vulnerabilities
- **Vite <=6.4.1 (HIGH):** Arbitrary file read via dev server WebSocket + path traversal
- **Undici CRLF Injection (varies):** Via upgrade option in HTTP client
- **yaml 2.0.0-2.8.2 (MODERATE):** Stack overflow via deeply nested YAML collections

### Secrets Scan
**Status:** PASS — No hardcoded secrets found
- All sensitive values use import.meta.env.PRIVATE_* or process.env.* patterns

---

## Phase 5: Code Quality & Refactoring Candidates

### 5.1 Large Files (>300 lines) — 20 files

| Lines | File | Concern |
|-------|------|---------|
| 1783 | src/components/EventCalendar.astro | Mega-component, needs decomposition |
| 1700 | src/utils/utils.js | God utility file, should be split |
| 1053 | src/pages/admin/events/[id].astro | Complex admin page |
| 1042 | src/pages/admin/index.astro | Admin dashboard |
| 945 | src/pages/admin/events/add.astro | Event creation form |
| 735 | src/pages/admin/events/index.astro | Event listing |
| 717 | src/utils/eventbrite-scraper.js | Scraper logic |
| 625 | src/utils/cms-utils.js | CMS utilities |
| 552 | src/utils/analytics-utils.js | Analytics utilities |

### 5.2 Dead Code
- src/utils/comments-content-utils.js — All functions return empty arrays
- src/utils/s3-upload.js — Not imported anywhere
- src/components/article/_PostComments copy.astro — Copy file with broken functionality

### 5.3 Root Sprawl — 13 files should be relocated
Scripts: check-images.js, check-pages.js, download-large-images.js, force-cron.js, upload-images-to-s3.js, syncAssets.js
Tests: test-assets.js, test-build-integrity.js, test-complete-cms.js, test-cron.js, test-github-cms.js
Artifacts: collapsible-test.html, sidebar-test.html

### 5.4 Dropbox Conflict Files — 14 files (HIGH PRIORITY)
The conflicted copy of index.astro is actively breaking the production build.

### 5.5 Missing Component Headers
All 72+ component files lack descriptive headers (low priority).

---

## Priority Actions

1. **DELETE Dropbox conflict files** — Breaking builds. Delete all 14 conflict files immediately.
2. **Run npx playwright install** — Zero automated test coverage until browsers are installed.
3. **Run npm audit fix** — 70 vulnerabilities including 1 critical and 35 high.
4. **Decompose EventCalendar.astro (1783L) and utils.js (1700L)** — Largest code quality risk.
5. **Move root scripts to scripts/ and tests/** — 13 files cluttering project root.
6. **Remove dead code** — Delete comments-content-utils.js, s3-upload.js, _PostComments copy.astro.
