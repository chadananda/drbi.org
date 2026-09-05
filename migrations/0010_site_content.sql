-- Schema for the content that is still baked into the build: the Markdown pages
-- under src/pages, the site config in src/data/site.json, the navigation in
-- src/data/siteLinks.json, and the board/staff bios hardcoded in about-us.astro.
--
-- Target is the existing `drbi-db`, not a second database: content that renders
-- on one page should not be split across two D1 instances and two bindings.
--
-- Site config reuses the existing `options` (name/value) table, which the
-- settings API at /api/admin/settings already exposes — a third settings store
-- would just be another place to look.
--
-- Idempotent: safe to run more than once.

-- Editorial pages. `slug` is the route without a leading slash, so
-- 'history/william-sears' serves at /history/william-sears.
CREATE TABLE IF NOT EXISTS site_pages (
  slug           TEXT PRIMARY KEY,
  route          TEXT,                              -- NULL when Astro does not route it
  title          TEXT NOT NULL DEFAULT '',
  label          TEXT,                              -- PageHero eyebrow
  subtitle       TEXT,
  description    TEXT,                              -- meta description
  image          TEXT,                              -- MDLayout imageMap keyword, not a URL
  image_position TEXT,
  author         TEXT,
  date_published TEXT,
  layout         TEXT,
  format         TEXT NOT NULL DEFAULT 'md',        -- md | mdx
  -- 1 = the source imports Astro components (EventCalendar, ImgBlock, CdnImage…).
  -- Such a page cannot be rendered from plain Markdown; migrating it needs those
  -- components replaced or a shortcode renderer. Recorded, not silently lost.
  has_components INTEGER NOT NULL DEFAULT 0,
  is_route       INTEGER NOT NULL DEFAULT 1,        -- 0 for _-prefixed files Astro skips
  body           TEXT NOT NULL DEFAULT '',
  source_path    TEXT,                              -- provenance, e.g. src/pages/terms.md
  draft          INTEGER NOT NULL DEFAULT 0,
  sort_order     INTEGER NOT NULL DEFAULT 0,
  created_at     TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_site_pages_route ON site_pages(route);
CREATE INDEX IF NOT EXISTS idx_site_pages_live ON site_pages(is_route, draft);

-- Navigation menus. One row per link; `menu` is the group name from
-- siteLinks.json (menuLinks, companyLinks, resourceLinks…).
CREATE TABLE IF NOT EXISTS site_links (
  id         TEXT PRIMARY KEY,                      -- "<menu>:<index>"
  menu       TEXT NOT NULL,
  title      TEXT NOT NULL,
  path       TEXT NOT NULL,
  parent_id  TEXT REFERENCES site_links(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_site_links_menu ON site_links(menu, sort_order);

-- Board of Directors and core staff shown on /about-us. Deliberately separate
-- from `team`, which holds article byline authors — merging them would put
-- board members into author dropdowns.
CREATE TABLE IF NOT EXISTS board_members (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  role       TEXT,                                  -- "Chairman", "Facilities Manager", …
  bio        TEXT,
  image      TEXT,
  group_name TEXT NOT NULL DEFAULT 'board',         -- board | staff
  sort_order INTEGER NOT NULL DEFAULT 0,
  active     INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_board_members_group ON board_members(group_name, sort_order);
