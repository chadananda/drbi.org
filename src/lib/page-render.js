// Pure helpers for rendering a page body that came out of D1 instead of a file.
// No database, no bindings, no Astro — unit testable under plain node.
//
// The problem this solves: a Markdown body stored in a column has lost its file
// context. `./_agr2.webp` means "next to the source file", which Astro resolves
// at build time into a hashed /_astro/ asset. Served from a row there is no
// source file, so those references have to be rewritten to an absolute URL — and
// if they cannot be rewritten to something that actually exists, the page must
// not be served from D1 at all. A broken image is worse than a stale one.

// Patterns are kept as source strings and compiled fresh on every use. A shared
// /g regex carries `lastIndex` between calls — `.test()` advances it and
// `matchAll` inherits it — which silently skips the first match on the second
// call. Building a new RegExp each time removes that whole class of bug.
const MD_IMAGE_SRC = '(!\\[[^\\]]*\\]\\()(\\.\\.?\\/[^)\\s]+)(\\)|\\s)';
// The same thing once rendered: src="./x.webp" (also covers <img> written as
// raw HTML inside the Markdown, which several of these pages use).
const HTML_SRC = '(\\s(?:src|href)=["\'])(\\.\\.?\\/[^"\']+)(["\'])';
const mdImageRe = () => new RegExp(MD_IMAGE_SRC, 'g');
const htmlSrcRe = () => new RegExp(HTML_SRC, 'g');

/** Does this body contain references that only make sense next to the file? */
export function hasRelativeImages(body = '') {
  const s = String(body);
  return mdImageRe().test(s) || htmlSrcRe().test(s);
}

/** List them, for diagnostics and tests. */
export function relativeImages(body = '') {
  const s = String(body);
  const out = [];
  for (const m of s.matchAll(mdImageRe())) out.push(m[2]);
  for (const m of s.matchAll(htmlSrcRe())) out.push(m[2]);
  return out;
}

/**
 * Directory a page's relative paths resolve against, derived from the source
 * file rather than the route (they differ for index pages).
 *   src/pages/history/william-sears.md -> 'history'
 *   src/pages/terms.md                 -> ''
 */
export function baseDirFor(sourcePath = '') {
  const rel = String(sourcePath).replace(/^src\/pages\//, '');
  const dir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
  return dir;
}

/** Normalise a/b/../c -> a/c, and drop leading ./ segments. */
export function normalisePath(path = '') {
  const out = [];
  for (const seg of String(path).split('/')) {
    if (!seg || seg === '.') continue;
    if (seg === '..') out.pop();
    else out.push(seg);
  }
  return out.join('/');
}

/**
 * Rewrite `./x.webp` / `../y.jpg` to `<cdnBase>/<dir>/x.webp`.
 * Absolute references (`/documents/…`, `https://…`) are left untouched: they
 * already resolve, and touching them would change output for no reason.
 */
export function rewriteImagePaths(body = '', { cdnBase = '', sourcePath = '' } = {}) {
  if (!cdnBase) return String(body);
  const base = String(cdnBase).replace(/\/+$/, '');
  const dir = baseDirFor(sourcePath);
  const abs = (target) => `${base}/${normalisePath(`${dir}/${target}`)}`;
  return String(body)
    .replace(mdImageRe(), (_m, open, target, close) => `${open}${abs(target)}${close}`)
    .replace(htmlSrcRe(), (_m, open, target, close) => `${open}${abs(target)}${close}`);
}

/**
 * Fenced code blocks. Rendering these without shiki would differ from the
 * file-backed output, so such a body is not served from D1 (see
 * render-markdown.js for why shiki is not bundled).
 */
export function hasCodeBlock(body = '') {
  return /^\s*(```|~~~)/m.test(String(body));
}

/**
 * May this row be served from D1?
 * Only when every relative reference can be turned into an absolute URL — i.e.
 * either there are none, or a CDN base is configured to rewrite them against.
 * Otherwise the caller falls back to the file-backed page.
 */
export function canRenderFromD1(body = '', cdnBase = '') {
  if (hasCodeBlock(body)) return false;
  return !hasRelativeImages(body) || Boolean(cdnBase);
}

/** Why a page was skipped, for logging and the status report. */
export function skipReason(body = '', cdnBase = '') {
  if (canRenderFromD1(body, cdnBase)) return null;
  if (hasCodeBlock(body)) return 'contains a code block; would render without syntax highlighting';
  return `unresolvable relative images (${relativeImages(body).length}); set PAGES_CDN_BASE once they are hosted`;
}

/**
 * The whole serve-or-fall-back decision, kept pure so it can be tested without
 * D1 or Workers bindings. `row` is a site_pages row, or null when the lookup
 * missed (or D1 was unreachable — the loader turns errors into null).
 *
 * Returns { serve: false, reason } or { serve: true, html }.
 */
export function decidePage({ row, enabled = false, cdnBase = '' } = {}) {
  if (!enabled) return { serve: false, reason: 'flag off' };
  if (!row) return { serve: false, reason: 'no row' };
  if (row.draft) return { serve: false, reason: 'draft' };
  // The query already filters these, but a row must never be served on the
  // strength of the WHERE clause alone — the four component pages stay on the
  // file path permanently, and a non-route has no business rendering.
  if (row.has_components) return { serve: false, reason: 'imports Astro components' };
  if (row.is_route === 0) return { serve: false, reason: 'not a route' };
  if (!row.html) return { serve: false, reason: 'no rendered html' };
  const reason = skipReason(row.html, cdnBase) ?? skipReason(row.body ?? '', cdnBase);
  if (reason) return { serve: false, reason };
  return {
    serve: true,
    html: rewriteImagePaths(row.html, { cdnBase, sourcePath: row.source_path }),
  };
}

/**
 * Orchestrates a page lookup: fetch, decide, rewrite. Pure with respect to the
 * platform — `getRow` is injected — so it is unit testable without D1 or a
 * Workers binding. src/lib/server/d1-pages.js wires in the real loader.
 *
 * A lookup that throws is treated as a miss. An unreachable database must fall
 * back to the file, never surface as a 500 on a live page.
 */
export async function resolvePage({ route, getRow, enabled = false, cdnBase = '', debug = false } = {}) {
  let row = null;
  if (enabled) {
    try {
      row = await getRow(route);
    } catch (err) {
      if (debug) console.log(`[d1-pages] ${route}: lookup threw (${err?.message ?? err}), serving file`);
      row = null;
    }
  }
  const verdict = decidePage({ row, enabled, cdnBase });
  if (!verdict.serve) {
    if (debug) console.log(`[d1-pages] ${route}: file (${verdict.reason})`);
    return null;
  }
  if (debug) console.log(`[d1-pages] ${route}: SERVED FROM D1 (${verdict.html.length} chars)`);
  return { row, html: verdict.html };
}

/**
 * Make the pre-rendered HTML match what Astro's own page pipeline emits, so a
 * body served from D1 is character-equivalent to the same page from its file.
 * Applied at ingest, so the Worker needs no Markdown dependency to run it.
 */
export function normalizeRenderedHtml(html = '') {
  const s = String(html ?? '');
  if (!s) return s;
  // Astro emits the named `&amp;`; the standalone processor emits numeric `&#x26;` — same character.
  const named = s.replace(/&#x26;/g, '&amp;');
  // Astro's slot render ends the markdown block with a newline; the processor does not.
  return named.endsWith('\n') ? named : `${named}\n`;
}
