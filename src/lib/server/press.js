// Press releases data access (D1). Draft in admin, publish to public /press pages.
import { db } from '../db';

export function slugify(s) {
  return String(s || '')
    .toLowerCase().trim()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80) || 'release';
}

async function uniqueSlug(base, excludeId = null) {
  let slug = base, n = 1;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    const r = await db.execute({
      sql: 'SELECT id FROM press_releases WHERE slug = ? AND (? IS NULL OR id != ?) LIMIT 1',
      args: [slug, excludeId, excludeId],
    });
    if (!r.rows.length) return slug;
    n += 1; slug = `${base}-${n}`;
  }
}

export async function listReleases() {
  try {
    const r = await db.execute('SELECT * FROM press_releases ORDER BY created_at DESC');
    return r.rows;
  } catch { return []; }
}

export async function listPublished() {
  try {
    const r = await db.execute(`SELECT * FROM press_releases WHERE status='published' ORDER BY COALESCE(published_at, created_at) DESC`);
    return r.rows;
  } catch { return []; }
}

export async function getRelease(id) {
  try {
    const r = await db.execute({ sql: 'SELECT * FROM press_releases WHERE id = ?', args: [id] });
    return r.rows[0] || null;
  } catch { return null; }
}

export async function getReleaseBySlug(slug) {
  try {
    const r = await db.execute({ sql: 'SELECT * FROM press_releases WHERE slug = ? LIMIT 1', args: [slug] });
    return r.rows[0] || null;
  } catch { return null; }
}

export async function upsertRelease({ id, title, slug, dateline, summary, body, status = 'draft', published_at = null }) {
  const base = slugify(slug || title);
  const finalSlug = await uniqueSlug(base, id ? Number(id) : null);
  if (id) {
    await db.execute({
      sql: `UPDATE press_releases SET title=?, slug=?, dateline=?, summary=?, body=?, status=?, published_at=? WHERE id=?`,
      args: [title, finalSlug, dateline, summary, body, status, published_at, id],
    });
    return Number(id);
  }
  const r = await db.execute({
    sql: `INSERT INTO press_releases (title, slug, dateline, summary, body, status, published_at) VALUES (?,?,?,?,?,?,?)`,
    args: [title, finalSlug, dateline, summary, body, status, published_at],
  });
  return Number(r.lastInsertRowid);
}

export async function deleteRelease(id) {
  try { await db.execute({ sql: 'DELETE FROM press_releases WHERE id = ?', args: [id] }); } catch {}
}

export async function pressStats() {
  try {
    const r = await db.execute(`SELECT
        SUM(CASE WHEN status='published' THEN 1 ELSE 0 END) AS published,
        SUM(CASE WHEN status='draft' THEN 1 ELSE 0 END) AS drafts,
        COUNT(*) AS total FROM press_releases`);
    const row = r.rows[0] || {};
    return { published: Number(row.published || 0), drafts: Number(row.drafts || 0), total: Number(row.total || 0) };
  } catch { return { published: 0, drafts: 0, total: 0 }; }
}
