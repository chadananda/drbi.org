// Media library data access. Bytes live in R2 (drbi.org/media/<slug>.<ext>); this is the
// searchable D1 metadata. Fail-soft: read helpers swallow errors and return empty.
import { db } from '@lib/db';

const CDN = 'https://cdn.shrtr.com';
const clean = (s) => String(s ?? '').trim();

// slug from a filename → flat, collision-resistant R2 key under drbi.org/media/.
export function mediaKey(filename) {
  const dot = filename.lastIndexOf('.');
  const ext = (dot > -1 ? filename.slice(dot + 1) : 'bin').toLowerCase().replace(/[^a-z0-9]/g, '') || 'bin';
  const base = (dot > -1 ? filename.slice(0, dot) : filename)
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'image';
  return { base, ext };
}
export const keyToUrl = (key) => `${CDN}/${key}`;

export async function insertMedia(row) {
  const r = await db.execute({
    sql: `INSERT INTO media (r2_key, url, filename, title, alt, description, tags,
            width, height, bytes, content_type, described_by, uploaded_by)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      row.r2_key, row.url || keyToUrl(row.r2_key), row.filename || '',
      clean(row.title), clean(row.alt), clean(row.description), clean(row.tags),
      row.width || 0, row.height || 0, row.bytes || 0, row.content_type || '',
      row.described_by || null, row.uploaded_by || null,
    ],
  });
  return r.lastInsertRowid;
}

export async function getMedia(id) {
  try {
    const r = await db.execute({ sql: 'SELECT * FROM media WHERE id = ?', args: [Number(id)] });
    return r.rows[0] || null;
  } catch { return null; }
}

// List with optional free-text (title/description/tags/filename) + single tag filter.
export async function listMedia({ q = '', tag = '', limit = 500 } = {}) {
  try {
    const where = [];
    const args = [];
    if (clean(q)) {
      const like = `%${clean(q).toLowerCase()}%`;
      where.push('(lower(title) LIKE ? OR lower(description) LIKE ? OR lower(tags) LIKE ? OR lower(filename) LIKE ?)');
      args.push(like, like, like, like);
    }
    if (clean(tag)) { where.push('lower(tags) LIKE ?'); args.push(`%${clean(tag).toLowerCase()}%`); }
    const sql = `SELECT * FROM media ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                 ORDER BY created_at DESC LIMIT ?`;
    args.push(limit);
    const r = await db.execute({ sql, args });
    return r.rows;
  } catch { return []; }
}

// Distinct tags across the library, with counts, for the filter chips.
export async function listTags() {
  try {
    const r = await db.execute({ sql: 'SELECT tags FROM media WHERE tags != ""' });
    const counts = new Map();
    for (const row of r.rows) {
      for (const t of String(row.tags).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)) {
        counts.set(t, (counts.get(t) || 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([tag, count]) => ({ tag, count }));
  } catch { return []; }
}

export async function updateMedia(id, fields) {
  const cols = ['title', 'alt', 'description', 'tags'];
  const sets = [], args = [];
  for (const c of cols) if (c in fields) { sets.push(`${c} = ?`); args.push(clean(fields[c])); }
  if (!sets.length) return false;
  args.push(Number(id));
  await db.execute({ sql: `UPDATE media SET ${sets.join(', ')} WHERE id = ?`, args });
  return true;
}

export async function deleteMedia(id) {
  await db.execute({ sql: 'DELETE FROM media WHERE id = ?', args: [Number(id)] });
}

export async function countMedia() {
  try {
    const r = await db.execute({ sql: 'SELECT COUNT(*) AS n FROM media' });
    return r.rows[0]?.n || 0;
  } catch { return 0; }
}

// Normalize a free-text tag string → clean, deduped, lowercased CSV.
export function normalizeTags(input) {
  const arr = Array.isArray(input) ? input : String(input || '').split(',');
  return [...new Set(arr.map((s) => String(s).trim().toLowerCase()).filter(Boolean))].join(', ');
}
