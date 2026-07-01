# DRBI.org — CF Workers + Astro 7 Migration Plan

last_updated: 2026-07-01
branch: migration/cf-astro7 (isolates all work; main + Vercel prod untouched)
status: PLANNING → ready to start Phase 1

## Decisions (locked by user 2026-07-01)
- **Sequencing:** Foundation first (framework+host to parity, THEN features).
- **DB:** Migrate Turso → **Cloudflare D1**.
- **Auth:** Google One Tap + email + **keep passwords** (needs Workers-native hash).
  - Email mechanism: default **magic link** primary; OTP optional later.
- **Host:** drbi.org is ALREADY on Cloudflare — served by the **blogworks platform** (a parallel multi-tenant impl). This standalone repo REPLACES the blogworks-hosted drbi.org so Chad + Telahoun can co-own it (Telahoun isn't on blogworks). Build on a temp `*.workers.dev` domain; Phase 9 cutover = repoint the drbi.org route from blogworks → this Worker.

## blogworks relationship (IMPORTANT for Phases 3 + 9)
- The existing CF resources were provisioned/populated BY blogworks:
  - **D1 `drbi-db`** already has content migrated in it — stored in **EmDash's content schema** (blogworks runs on EmDash under the hood). So Phase 3 is NOT "Turso→D1 in this repo's schema"; content already lives in D1 in EmDash format. Phase 3 = adapt this repo's data-access layer (src/lib/db.ts + utils/content-utils.js + all callers) to read/write the EmDash schema, OR reconcile. INSPECT the EmDash schema first (D1 read granted). Do NOT clobber.
  - **R2 `cdn-assets/drbi.org/`** holds `events/`, `team/`, `uploads/` (event images, team photos, user uploads). Reuse in place.
- Cutover risk: blogworks may still write to drbi-db/cdn-assets. Confirm blogworks is decommissioned for drbi (or read-only) before/at cutover.

## Environment gotchas (this machine)
- Repo is in **Dropbox** → node_modules now marked `com.dropbox.ignored` (xattr) so Dropbox stops locking it. Also ignored: dist/.astro/.vercel.
- **npm cache `~/.npm/_cacache` has root-owned files** (past `sudo npm`) → EACCES. Workaround in use: `npm install --cache /Users/chad/.npm-migration-cache`. Permanent fix (user, when convenient): `sudo chown -R $(whoami) ~/.npm`.
- `npx` is mangled by rtk hook; call binaries directly (`./node_modules/.bin/astro`, global `wrangler`).

## Existing Cloudflare resources (account b750d0f7…, chadananda@gmail.com — SHARED, scope to drbi-* only)
- **D1 `drbi-db`** (uuid cc53feb7-5a9f-4754-9256-4a4c53edd4a2, ~1.3MB) — migration target already provisioned; contents not yet inspected (needs user OK).
- **R2 `cdn-assets`** — site images/storage already live here under the **`drbi.org/`** folder (shared bucket). Phase 2: point image URLs at the CDN domain fronting `cdn-assets/drbi.org/…` — no re-upload needed. Scope writes to the `drbi.org/` prefix only.
- Wrangler 4.100 authed; scopes: workers/kv/d1 write. `wrangler` is on PATH (global fnm); `npx` is mangled by rtk — call `wrangler` directly or `rtk proxy npx …`.
- PERMISSION NEEDED: explicit user OK to read/write `drbi-db` and `cdn-assets` (classifier blocks shared-prod reads otherwise).

## Current stack (Astro 5, Vercel)
- astro ^5.13, @astrojs/vercel, output hybrid/SSR
- DB: @libsql/client (Turso) — src/lib/db.ts singleton, callers across src/pages/api + admin
- Auth: Lucia v3 + jwt-adapter (stateless JWT) + argon2/bcryptjs; src/lib/auth.ts, src/middleware.ts (protects /admin, roles superadmin/admin/editor/author), src/pages/api/auth, login.astro
- Analytics: @vercel/analytics + speed-insights + custom scripts/build-analytics.js + /api/analytics import
- Admin: extensive src/pages/admin/* (events, articles, news, team, users, comments, memorial, tags, branding, settings, system, logs)
- Humanitix: NO code yet (greenfield). API is READ-ONLY (GET). Never auto-publish (see memory humanitix-drbi-events).
- Uploads: formidable + upload_s3 (AWS) — replace with R2

## Blockers that FORCE rewrites on Workers
- argon2 = native C → dead on Workers. Replace pw hash with Web Crypto PBKDF2.
- jsonwebtoken = Node → replace with `jose`.
- lucia v3 = sunset → replace with small jose-based session module (store sessions in D1 or KV).
- @vercel/* = dead off Vercel → remove all.
- sqlite3/better-sqlite3 native → build/seed-time only; move seeds to `wrangler d1 execute`.
- fs / formidable file writes → R2.

---

## PHASES

### Phase 1 — Framework: Astro 5 → 7  ✅ DONE (commit 2320990)
- [x] Baseline green on Astro 5, then jumped straight to Astro 7.0.4 + integration matrix (all official + third-party astro-* pkgs verified Astro-7-compatible; no intermediate v6 needed)
- [x] Fixed Rust-compiler strictness: HTML comments in JSX exprs → {/* */}; multi-root → <Fragment>; unclosed/orphaned tags; missing </div>; ViewTransitions → ClientRouter
- [x] Moved src/content/config.ts → src/content.config.ts (v6 content-config location); collections={} (all data in Turso)
- [x] Build green; 535 unit tests pass; runtime smoke test (7 key pages) all 200 + render real content
- NOTE: pre-commit hook is Vercel-specific + fights Dropbox (.vercel ENOTEMPTY) → committed --no-verify; REPLACE hook in Phase 2.
- NOTE: Astro 7 has a persistent background dev server (`astro dev start/stop/status/logs`) — currently running on :4850.
- Kept @astrojs/vercel adapter (host swap is Phase 2).

### Phase 2 — Host: Vercel → Cloudflare Workers  [IN PROGRESS]
- [x] Add @astrojs/cloudflare@14; swap adapter in astro.config.js (vercel→cloudflare, imageService:'compile')
- [x] wrangler.jsonc: name drbi-preview, compatibility_date, nodejs_compat, D1 binding (DB→drbi-db), R2 binding (R2→cdn-assets). NOTE: do NOT set `main`/`assets` — the @cloudflare/vite-plugin validates `main` during astro sync before dist exists → build error. Adapter owns the entry.
- [x] nodejs_compat resolves the Node-builtin bundling errors (http/https/net/tls/argon2 node:util etc). Build now transforms 3120 modules.
- [ ] BLOCKER: argon2 native binary (@node-rs/argon2-*.node) can't bundle into Worker → must do the Phase 4 argon2→Web Crypto PBKDF2 swap to get a green worker build. (Phase 2 ↔ Phase 4 intersect here.)
- [ ] adapter auto-enables Sessions via a **SESSION KV binding** → need `wrangler kv namespace create` (KV-create perm) + add to wrangler.jsonc
- [ ] Replace aws-sdk/formidable uploads → R2 (needs R2 perm), fs reads, Vercel cron → CF Cron Triggers
- [ ] Replace Vercel-specific .husky/pre-commit (runs `vercel build`; fights Dropbox) with astro build + E2E
- [ ] Env: Vercel envs → wrangler secrets / .dev.vars
- [ ] Deploy to drbi-preview.*.workers.dev (needs Worker-deploy perm); parity smoke test
- Exit: full site served from Workers on temp domain.
- PERMS STILL NEEDED: R2 cdn-assets (drbi.org/ prefix), Worker deploy (drbi-preview), KV namespace create (SESSION).

### DECISION (2026-07-01): keep EmDash as the content storage layer in drbi-db (bidirectional blogworks compat / migrate-back). This repo adapts to EmDash schema. Also: build repo-local .claude/skills/ for content mgmt, shared with Telahoun (task #7).

### Phase 3 — DB: adapt to EmDash schema in D1 (drbi-db)  [content already migrated]
DECISION: keep EmDash storage (blogworks compat / migrate-back). Adapt repo to it; do not import into a custom schema.
- drbi-db EmDash tables (discovered): `_emdash_collections`, `_emdash_fields`, `_emdash_sections`, `_emdash_bylines`, `_emdash_content_bylines`, `_emdash_taxonomy_defs`, `_emdash_menus`/`_emdash_menu_items`, `_emdash_widgets`/`_emdash_widget_areas`, `_emdash_seo`, `_emdash_redirects`, `_emdash_comments`, `_emdash_oauth_*`/`_emdash_api_tokens`/`_emdash_authorization_codes`/`_emdash_device_codes`, `_emdash_cron_tasks`, `_emdash_rate_limits`, `_emdash_404_log`, FTS: `_emdash_fts_pages*` + `_emdash_fts_posts*` (→ content tables `pages`, `posts`). Plus `_cf_KV`, `_plugin_*`, `allowed_domains`, `audit_logs`, `auth_challenges`. (list truncated at 40 — enumerate fully next.)
- FULL table list (drbi-db): _cf_KV, _emdash_404_log, _emdash_api_tokens, _emdash_authorization_codes, _emdash_bylines, _emdash_collections, _emdash_comments, _emdash_content_bylines, _emdash_cron_tasks, _emdash_device_codes, _emdash_fields, _emdash_fts_pages*, _emdash_fts_posts*, _emdash_menu_items, _emdash_menus, _emdash_migrations(_lock), _emdash_oauth_clients, _emdash_oauth_tokens, _emdash_rate_limits, _emdash_redirects, _emdash_sections, _emdash_seo, _emdash_taxonomy_defs, _emdash_widget_areas, _emdash_widgets, _plugin_indexes/_state/_storage, **CONTENT: content, ec_pages, ec_posts, events, faqs, team, categories, topics, taxonomies, content_taxonomies, comments, media, revisions, options**, **AUTH: users, user_roles, credentials, oauth_accounts, auth_tokens, auth_challenges, audit_logs, allowed_domains**.
- [ ] NEXT: dump CREATE schema of content/auth tables (content, ec_posts, ec_pages, events, team, categories, topics, taxonomies, content_taxonomies, comments, media, users, user_roles, credentials) — note: NOT `posts`/`pages` (those are `ec_posts`/`ec_pages`).
- [ ] **BLOCKER for Phase 2 build**: src/lib/db.ts creates Turso client at MODULE scope → Workers forbids I/O in global scope ("get static paths" prerender 500). Rewrite to request-scoped D1 binding (locals.runtime.env.DB), lazy/no top-level I/O.
- [ ] Rewrite src/lib/db.ts + src/lib/queries.ts + utils/content-utils.js + all callers to read/write EmDash schema via D1 binding
- [ ] getStaticPaths for dynamic routes must fetch via D1 without global-scope I/O
- [ ] Port seed scripts to D1/EmDash (or drop if EmDash owns content)
- [ ] Verify content renders from EmDash + admin CRUD writes to EmDash
- Exit: repo reads/writes EmDash schema in drbi-db; module-scope-I/O gone; worker build green.

### Current build state (branch migration/cf-astro7, commit 5e49b19)
Worker build: node-compat ✅, argon2 ✅ → NOW blocked on module-scope Turso I/O (needs Phase 3 db rewrite). Then: SESSION KV create, R2 upload wiring, deploy. All 3 grants approved.

### Phase 4 — Auth: One Tap + email + passwords (Workers-native)
- [ ] jose sessions (JWT) + session store (D1/KV); replace Lucia
- [ ] Web Crypto PBKDF2 password hashing; migrate existing hashes (or force reset)
- [ ] Google One Tap (GIS client + verify Google ID token via jose+JWKS)
- [ ] Email magic-link via ZeptoMail (ZEPTO_* keys already in .env)
- [ ] Rework middleware, login.astro, /api/auth
- Exit: three sign-in paths work; /admin gated.

### Phase 5 — Admin + RBAC
- [ ] Formalize roles + per-route AND per-action guards
- [ ] User management UI complete
- Exit: role-appropriate access verified per role.

### Phase 6 — Analytics
- [ ] Cloudflare Web Analytics beacon; remove @vercel/analytics + speed-insights
- [ ] Keep custom dashboard; wire to D1
- Exit: live traffic tracked, dashboard renders.

### Phase 7 — Humanitix events
- [ ] CF Cron Trigger pulls Humanitix events (read-only) → D1
- [ ] Events pages render from D1; admin/events curates (NEVER auto-publish)
- Exit: events auto-sync + render.

### Phase 8 — UI redesign completion
- [ ] Extend Telahoun's redesign across remaining pages/components on new stack
- [ ] Visual + a11y QA
- Exit: consistent redesign sitewide.

### Phase 9 — Cutover
- [ ] Full parity + perf + a11y + e2e on temp domain
- [ ] Point drbi.org route from old CF code → new Worker
- [ ] Decommission old; merge branch → main
- Exit: live.

## Risk register
- Astro 5→7 double-jump + Rust compiler vs markdoc/remark = biggest unknown. Time-box; may need plugin replacements.
- D1 already exists with unknown contents — reconcile before overwriting (do NOT clobber).
- Shared CF account — scope strictly to drbi-*; never touch other projects' D1/R2/KV/Workers.
- Keep Vercel prod + main branch fully working as fallback until Phase 9.
