#!/usr/bin/env node
// Ingests build-time-baked content into D1: the Markdown/MDX pages under
// src/pages, src/data/site.json, src/data/siteLinks.json, and the board/staff
// bios hardcoded in about-us.astro.
//
// Reads the repo, emits idempotent SQL (INSERT OR REPLACE). It does not talk to
// Cloudflare itself — apply the output with:
//   wrangler d1 execute drbi-db --remote --file migrations/0011_seed_site_content.sql
//
// Usage: node scripts/ingest-site-content.mjs [--out <file>] [--dry]
// Deps: gray-matter (already a dependency), node:fs.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import fg from 'fast-glob';
import matter from 'gray-matter';
import { createSatteriMarkdownProcessor } from '@astrojs/markdown-satteri';
import { normalizeRenderedHtml } from '../src/lib/page-render.js';
import { configToRows } from '../src/lib/site-config-format.js';

const ROOT = join(fileURLToPath(new URL('.', import.meta.url)), '..');
const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const OUT = outIdx >= 0 ? args[outIdx + 1] : join(ROOT, 'migrations', '0011_seed_site_content.sql');
const DRY = args.includes('--dry');

// ─── SQL helpers ─────────────────────────────────────────────────────────────

// SQLite string literal: double the single quotes. Null stays NULL (unquoted).
const q = (v) => {
  if (v === null || v === undefined || v === '') return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
};
// Always-quoted variant for NOT NULL columns: an empty value must stay '' and
// must not collapse to NULL (options.value and site_pages.body are NOT NULL).
const qs = (v) => `'${String(v ?? '').replace(/'/g, "''")}'`;
const qn = (v) => (v === null || v === undefined || v === '' ? 'NULL' : String(Number(v) || 0));
const bool = (v) => (v ? 1 : 0);

// One statement per row, not a single multi-VALUES insert: D1 rejects an
// oversized statement with SQLITE_TOOBIG, and the page bodies alone run to
// ~110KB. Per-row statements keep the largest well inside the limit.
const rowsToInsert = (table, columns, rows) => {
  if (!rows.length) return `-- ${table}: nothing to insert\n`;
  const head = `INSERT OR REPLACE INTO ${table} (${columns.join(', ')}) VALUES`;
  return rows.map((r) => `${head} (${columns.map((c) => r[c] ?? 'NULL').join(', ')});`).join('\n') + '\n';
};

// ─── 1. Markdown / MDX pages ─────────────────────────────────────────────────

// Astro does not route files or directories whose name starts with an underscore.
const isRouted = (rel) => !rel.split('/').some((seg) => seg.startsWith('_'));

// Route from a file path: src/pages/history/index.md -> /history
//                         src/pages/terms.md         -> /terms
function routeFor(rel) {
  let p = rel.replace(/^src\/pages\//, '').replace(/\.(md|mdx)$/, '');
  if (p.endsWith('/index')) p = p.slice(0, -'/index'.length);
  if (p === 'index') p = '';
  return '/' + p;
}

// An MDX (or MD) file that imports or invokes Astro components cannot be
// rendered from plain Markdown stored in a column.
const usesComponents = (body) =>
  /^import\s+.+from\s+['"][^'"]+\.astro['"]/m.test(body) ||
  /^import\s+\{[^}]*\}\s+from\s+['"]astro:/m.test(body) ||
  /<[A-Z][A-Za-z0-9]*[\s/>]/.test(body);

// Astro's own processor, so the stored HTML matches what Astro produces for the
// same file. Running it here, at ingest time, keeps ~2.1 MB gzipped of shiki out
// of the Worker bundle.
//
// astro 7.3 renamed this: @astrojs/markdown-remark -> @astrojs/markdown-satteri.
// Depend on it explicitly rather than transitively — @astrojs/mdx@8 dropped the
// old package, which silently broke this script until it was pinned here.
const processor = await createSatteriMarkdownProcessor({});

async function renderBody(md) {
  const src = String(md ?? '').trim();
  if (!src) return '';
  const { code } = await processor.render(src);
  // Match Astro's own page output exactly — see normalizeRenderedHtml.
  return normalizeRenderedHtml(code);
}

async function collectPages() {
  const files = fg
    .sync(['src/pages/**/*.md', 'src/pages/**/*.mdx'], { cwd: ROOT, dot: false })
    .sort();
  return await Promise.all(files.map(async (rel, i) => {
    const raw = readFileSync(join(ROOT, rel), 'utf8');
    const { data: fm, content: body } = matter(raw);
    const routed = isRouted(rel);
    const route = routed ? routeFor(rel) : null;
    const slug = (route ?? '/' + rel.replace(/^src\/pages\//, '').replace(/\.(md|mdx)$/, '')).replace(/^\//, '');
    const format = rel.endsWith('.mdx') ? 'mdx' : 'md';
    return {
      slug: q(slug || 'index'),
      route: q(route),
      title: q(fm.title ?? ''),
      label: q(fm.label),
      subtitle: q(fm.subtitle),
      description: q(fm.description),
      image: q(fm.image),
      image_position: q(fm.imagePosition),
      author: q(fm.author),
      date_published: q(fm.date),
      layout: q(fm.layout),
      format: q(format),
      has_components: bool(usesComponents(body)),
      is_route: bool(routed),
      body: qs(body.trim()),
      html: qs(await renderBody(body)),
      source_path: q(rel),
      draft: bool(fm.draft),
      sort_order: qn(i),
      _meta: { rel, routed, format, components: usesComponents(body), bytes: body.length },
    };
  }));
}

// ─── 2. site.json -> site_config rows ───────────────────────────────────────

// Typed key/value, so nested objects (youtube, twitter, podcast) and arrays
// (languages, post_types) survive the round trip instead of flattening to text.
// This replaces the `site.*` rows earlier seeds wrote into the shared `options`
// table - one source of truth. Those rows are inert and are left alone rather
// than deleted; pruning production data is Chad's call.
function collectSiteConfig() {
  const json = JSON.parse(readFileSync(join(ROOT, 'src/data/site.json'), 'utf8'));
  return configToRows(json).map((r) => ({
    key: qs(r.key),
    value: qs(r.value),
    value_type: qs(r.value_type),
    _key: r.key,
    _type: r.value_type,
  }));
}

// ─── 3. siteLinks.json -> site_links rows ────────────────────────────────────

function collectLinks() {
  const json = JSON.parse(readFileSync(join(ROOT, 'src/data/siteLinks.json'), 'utf8'));
  const out = [];
  for (const [menu, links] of Object.entries(json)) {
    if (!Array.isArray(links)) continue;
    links.forEach((l, i) => {
      const id = `${menu}:${i}`;
      out.push({
        id: q(id), menu: q(menu), title: q(l.title), path: q(l.path),
        parent_id: 'NULL', sort_order: qn(i), _menu: menu,
      });
      // One level of children is all the current data uses.
      (Array.isArray(l.children) ? l.children : []).forEach((c, j) => {
        out.push({
          id: q(`${id}:${j}`), menu: q(menu), title: q(c.title), path: q(c.path),
          parent_id: q(id), sort_order: qn(j), _menu: menu,
        });
      });
    });
  }
  return out;
}

// ─── 4. Board + core staff from about-us.astro ───────────────────────────────

const slugify = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const clean = (s) =>
  s.replace(/<[^>]+>/g, '')          // strip inline markup (<em>, <br/>…)
   .replace(/\s+/g, ' ')
   .trim();

function collectBoard() {
  const src = readFileSync(join(ROOT, 'src/pages/about-us.astro'), 'utf8');
  const out = [];

  // Scope to the Board section so other cards on the page cannot leak in.
  const boardStart = src.indexOf('Board of Directors');
  const boardEnd = src.indexOf('Our Core Team');
  const boardSrc = boardStart >= 0 && boardEnd > boardStart ? src.slice(boardStart, boardEnd) : '';

  // Cards vary: some have a photo, some initials in a div; some have a bio,
  // some only a role. Split into blocks first, then read optional fields.
  const blocks = boardSrc.split('<div class="bg-surface rounded-2xl p-8 flex gap-6 shadow-sm">').slice(1);
  let i = 0;
  for (const block of blocks) {
    const name = block.match(/<h3 class="font-serif text-lg text-ink">([^<]+)<\/h3>/)?.[1];
    if (!name) continue;
    const role = block.match(/<p class="text-xs text-brand uppercase tracking-widest mb-2">([^<]*)<\/p>/)?.[1] ?? '';
    const bio = block.match(/<p class="text-body text-sm leading-relaxed">([\s\S]*?)<\/p>/)?.[1] ?? '';
    const image = block.match(/<img\s+src="([^"]+)"/)?.[1] ?? '';
    out.push({
      id: q(slugify(name)), name: q(clean(name)), role: q(clean(role)),
      bio: q(clean(bio)), image: q(image), group_name: q('board'),
      sort_order: qn(i++), active: 1, _group: 'board',
    });
  }

  // Core team: a literal array of { name, role } objects in the template.
  const arr = src.match(/\{\s*\[\s*(\{\s*name:[\s\S]*?)\]\.map\(person/);
  let j = 0;
  if (arr) {
    const entryRe = /\{\s*name:\s*"([^"]+)",\s*role:\s*"([^"]+)"\s*\}/g;
    let e;
    while ((e = entryRe.exec(arr[1]))) {
      out.push({
        id: q(slugify(e[1])), name: q(e[1]), role: q(e[2]), bio: 'NULL',
        image: 'NULL', group_name: q('staff'), sort_order: qn(j++), active: 1, _group: 'staff',
      });
    }
  }

  // Janet Ruhe-Schoen is written as a bespoke card rather than an array entry.
  const special =
    src.match(/<img\s+src="(\/documents\/Janet-Ruhe-Schoen\.jpg)"[\s\S]*?<p class="font-serif text-ink">([^<]+)<\/p>\s*<p class="text-sm text-brand tracking-wide mb-3">([^<]*)<\/p>\s*<p class="text-body text-sm leading-relaxed">([\s\S]*?)<\/p>/);
  if (special) {
    out.push({
      id: q(slugify(special[2])), name: q(clean(special[2])), role: q(clean(special[3])),
      bio: q(clean(special[4])), image: q(special[1]), group_name: q('staff'),
      sort_order: qn(j++), active: 1, _group: 'staff',
    });
  }
  return out;
}

// ─── build the file ──────────────────────────────────────────────────────────

const pages = await collectPages();
const settings = collectSiteConfig();
const links = collectLinks();
const board = collectBoard();

const sql = [
  '-- GENERATED by scripts/ingest-site-content.mjs — do not hand-edit.',
  '-- Re-run the script to regenerate from the files in src/.',
  `-- Generated ${new Date().toISOString().slice(0, 10)} from ${pages.length} pages, ` +
    `${settings.length} site_config keys, ${links.length} links, ${board.length} people.`,
  '-- Requires 0010_site_content.sql, 0012_site_pages_html.sql and 0013_site_config.sql.',
  '-- Idempotent: INSERT OR REPLACE throughout.',
  '',
  rowsToInsert(
    'site_pages',
    ['slug', 'route', 'title', 'label', 'subtitle', 'description', 'image', 'image_position',
     'author', 'date_published', 'layout', 'format', 'has_components', 'is_route', 'body',
     'html', 'source_path', 'draft', 'sort_order'],
    pages,
  ),
  '',
  rowsToInsert('site_config', ['key', 'value', 'value_type'], settings),
  '',
  rowsToInsert('site_links', ['id', 'menu', 'title', 'path', 'parent_id', 'sort_order'], links),
  '',
  rowsToInsert('board_members', ['id', 'name', 'role', 'bio', 'image', 'group_name', 'sort_order', 'active'], board),
].join('\n');

// ─── report ──────────────────────────────────────────────────────────────────

const routed = pages.filter((p) => p._meta.routed);
const needsWork = pages.filter((p) => p._meta.components);
console.log(`pages          ${pages.length}  (${routed.length} routed, ${pages.length - routed.length} not routed)`);
console.log(`  portable     ${pages.length - needsWork.length}  plain Markdown, migrates cleanly`);
console.log(`  needs work   ${needsWork.length}  imports Astro components:`);
for (const p of needsWork) console.log(`                 ${p._meta.rel}`);
const byType = settings.reduce((a, r) => ((a[r._type] = (a[r._type] || 0) + 1), a), {});
console.log(`site config    ${settings.length}  from site.json -> site_config  (${Object.entries(byType).map(([k, v]) => `${k}:${v}`).join(', ')})`);
console.log(`links          ${links.length}  across ${new Set(links.map((l) => l._menu)).size} menus`);
console.log(`board/staff    ${board.length}  (${board.filter((b) => b._group === 'board').length} board, ${board.filter((b) => b._group === 'staff').length} staff)`);

if (DRY) {
  console.log('\n--dry: nothing written');
} else {
  writeFileSync(OUT, sql);
  console.log(`\nwrote ${relative(ROOT, OUT)}  (${(sql.length / 1024).toFixed(1)} KB)`);
  console.log('apply with: wrangler d1 execute drbi-db --remote --file ' + relative(ROOT, OUT));
}
