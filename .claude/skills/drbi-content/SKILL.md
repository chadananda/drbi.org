---
name: drbi-content
description: Create, edit, and manage drbi.org content (articles, news, memorial, events, team, categories/topics) and whitelist users. Use whenever someone wants to add/update/remove site content or manage admin access. Content lives in Cloudflare D1 (drbi-db) and images in R2 (cdn.shrtr.com/drbi.org/); the site runs on Cloudflare Workers (Astro 7). Prefer the admin UI; use the API or direct D1 only for bulk/programmatic work.
---

# Managing drbi.org content

drbi.org is an Astro 7 site on **Cloudflare Workers**, with content in **D1 (`drbi-db`)** and images in **R2 (`cdn-assets`, bucket path `drbi.org/`, served at `https://cdn.shrtr.com/drbi.org/...`)**. The D1 schema is EmDash-style (shared with the blogworks platform). Preview/prod worker: `drbi-preview` → https://drbi-preview.chadananda.workers.dev.

**Golden rule:** for normal content work, use the **admin UI** — it handles validation, slugs, R2 image upload (keyless), and the correct schema. Only touch D1 directly for bulk edits or migrations, and never clobber blogworks data (the `ec_posts`/`ec_pages`/`_emdash_*` tables belong to EmDash — leave them alone; drbi content is in `content`/`events`/`team`/`categories`/`topics`).

## Signing in
`/login` — Google One Tap, an email magic-link, or the break-glass superadmin password. Access is a **whitelist**: the env `SITE_ADMIN_EMAIL` is superadmin; other admins/editors are rows in the D1 `users` table (add them at `/admin/users`). Roles: `superadmin` > `admin` > `editor` > `author` (stored as integer levels 100/40/30/20).

## Content model (D1 `content` table — collections `articles`, `news`, `memorial`)
Key columns: `id`, `slug`, `collection`, `title`, `description`, `desc_125`, `abstract`, `body` (markdown), `post_type`, `language` (default `en`), `draft` (0/1), `author`, `editor`, `category`, `topics` (JSON array), `keywords` (JSON array), `date_published`, `date_modified`, `image_src`, `image_alt`, `audio`. Unique on `(slug, language)`. Drafts (`draft=1`) are hidden on the public site.

Other content: **`events`** (title, short/full_description, start_date, main_image, teacher_image, registration_url, visible, featured…), **`team`** (name, role, title, bio, image, email, sort_order), **`categories`**/**`topics`**/**`taxonomies`**.

## Admin workflows (preferred)
| Task | Where |
|------|-------|
| List / add / edit articles | `/admin/articles`, `/admin/articles/add`, `/admin/articles/<slug>` |
| Edit news / memorial | `/admin/news/<slug>`, `/admin/memorial/<slug>` |
| Events | `/admin/events`, `/admin/events/add`, `/admin/events/<id>` |
| Team members | `/admin/team`, `/admin/team/<slug>` |
| Categories / topics | `/admin/categories`, `/admin/topics` |
| Whitelist users (add admins/editors by email) | `/admin/users`, `/admin/users/add` |
| Comments moderation | `/admin/comments` |

Images: drop them into the editor's image upload — it POSTs to `/api/upload_s3`, which writes to R2 via the `env.R2` binding (**no AWS keys**) and returns a `https://cdn.shrtr.com/drbi.org/...` URL. New uploads land under `drbi.org/uploads/`, `drbi.org/events/`, `drbi.org/team/`.

## Programmatic (API) — for scripts/bulk
Admin API routes require a valid session (`sessionid` from the `auth_session` cookie, or `Authorization: Bearer <sessionid>`), and Astro CSRF requires an `Origin` header matching the site.
- **Content**: `POST /api/posts` or `POST /api/post_db` → `createContent`/`updateContent` (fields mirror the `content` columns; pass `content` for the markdown body).
- **Events**: `POST /api/events` (create/update; `{id, ...}` updates).
- **Users**: `POST /api/users` `{name, email, role}` (password optional — passwordless whitelist), `DELETE /api/users?id=<id>`.

## Direct D1 (power user only — verify before writing)
```bash
# read
wrangler d1 execute drbi-db --remote --command \
  "SELECT slug, title, draft FROM content WHERE collection='articles' ORDER BY date_published DESC;"
# example update (reversible; always confirm the row first)
wrangler d1 execute drbi-db --remote --command \
  "UPDATE content SET draft=0 WHERE slug='some-slug';"
```
Image URLs in content must point at `https://cdn.shrtr.com/drbi.org/...` (S3 URLs are dead). To add a brand-new asset outside the admin, upload it to R2 under the `drbi.org/` prefix: `wrangler r2 object put cdn-assets/drbi.org/uploads/<name> --file=<path>`.

## Deploy after content-code changes
Content edits via admin/API are live immediately (D1). Only redeploy the worker for *code* changes: `npm run build && wrangler deploy -c dist/server/wrangler.json`. Gate first with `npm run predeploy:test`.

## Guardrails
- Never write to EmDash tables (`ec_*`, `_emdash_*`) — those are blogworks'.
- Secrets live in Cloudflare's secret store, never in code. Local dev reads `.dev.vars`.
- Humanitix event data is **read-only** and must never be auto-published — curate in the admin.
