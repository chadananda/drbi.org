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
  - **D1 `drbi-db`** already has blogworks' data → decide in Phase 3: reuse it as-is, or fresh schema. Do NOT clobber without reconciling.
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

### Phase 1 — Framework: Astro 5 → 6 → 7  [KEEP Vercel adapter here to isolate framework breakage from host breakage]
- [ ] Dep audit; branch build baseline green on Astro 5
- [ ] Upgrade 5→6 (Fonts API, CSP, Vite Environment API). Fix breakages.
- [ ] Upgrade 6→7 (Vite 8, Rust-only compiler). Highest risk: markdoc/mdx/remark-attr/astro-remote. Fix.
- [ ] `astro check` + build + test:unit + test:build green
- Exit: site builds & renders on Astro 7, still on Vercel adapter.

### Phase 2 — Host: Vercel → Cloudflare Workers
- [ ] Remove @astrojs/vercel + @vercel/*; add @astrojs/cloudflare
- [ ] wrangler.jsonc (name drbi-preview), nodejs_compat, output:'server', prerender=true on static pages
- [ ] Bind D1 (drbi-db) + R2 (cdn-assets) + KV(session) via runtime; astro locals.runtime.env typing
- [ ] Replace uploads (formidable/S3 → R2), fs reads, Vercel cron → CF Cron Triggers
- [ ] Env: Vercel envs → wrangler secrets / .dev.vars (TURSO/D1, JWT, ZEPTO_*, Google client id, SITE_ADMIN_EMAIL)
- [ ] Deploy to drbi-preview.*.workers.dev; parity smoke test
- Exit: full site served from Workers on temp domain.

### Phase 3 — DB: Turso → D1
- [ ] Inspect drbi-db (schema/data already there?). Reconcile with Turso schema.
- [ ] Export Turso schema+data; import to D1 (wrangler d1 execute --file / migrations)
- [ ] Rewrite src/lib/db.ts + callers: libsql client → D1 binding (env.DB.prepare) via locals.runtime
- [ ] Port seed scripts (db:seed:*) to D1
- [ ] Verify all reads/writes (content, admin CRUD)
- Exit: D1 is sole datastore; Turso removed.

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
