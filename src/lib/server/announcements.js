// Announcements data access (D1). Internal team broadcasts + optional public site banner.
// All reads are fail-soft so the admin page renders even if the table is momentarily unavailable.
import { db } from '../db';

export function parseAudience(a) {
  try {
    const o = typeof a === 'string' ? JSON.parse(a) : (a || {});
    return { selected: Array.isArray(o.selected) ? o.selected : [], includeSubscribers: !!o.includeSubscribers };
  } catch {
    return { selected: [], includeSubscribers: false };
  }
}

export async function listAnnouncements() {
  try {
    const r = await db.execute('SELECT * FROM announcements ORDER BY COALESCE(sent_at, created_at) DESC');
    return r.rows;
  } catch { return []; }
}

export async function getAnnouncement(id) {
  try {
    const r = await db.execute({ sql: 'SELECT * FROM announcements WHERE id = ?', args: [id] });
    return r.rows[0] || null;
  } catch { return null; }
}

export async function upsertAnnouncement({ id, subject, body, audience, banner = 0, banner_tone = 'info', banner_until = null, status = 'draft' }) {
  const aud = typeof audience === 'string' ? audience : JSON.stringify(audience || {});
  if (id) {
    await db.execute({
      sql: `UPDATE announcements SET subject=?, body=?, audience=?, banner=?, banner_tone=?, banner_until=?, status=? WHERE id=?`,
      args: [subject, body, aud, banner ? 1 : 0, banner_tone, banner_until, status, id],
    });
    return Number(id);
  }
  const r = await db.execute({
    sql: `INSERT INTO announcements (subject, body, audience, banner, banner_tone, banner_until, status) VALUES (?,?,?,?,?,?,?)`,
    args: [subject, body, aud, banner ? 1 : 0, banner_tone, banner_until, status],
  });
  return Number(r.lastInsertRowid);
}

export async function markSent(id, sentCount, recipientCount) {
  await db.execute({
    sql: `UPDATE announcements SET status='sent', sent_at=datetime('now'), sent_count=?, recipient_count=? WHERE id=?`,
    args: [sentCount, recipientCount, id],
  });
}

export async function deleteAnnouncement(id) {
  try { await db.execute({ sql: 'DELETE FROM announcements WHERE id = ?', args: [id] }); } catch {}
}

// Active public banner: the most recent sent announcement flagged as a banner and not expired.
export async function activeBanner() {
  try {
    const r = await db.execute({
      sql: `SELECT id, subject, body, banner_tone, banner_until FROM announcements
            WHERE banner = 1 AND status = 'sent'
              AND (banner_until IS NULL OR banner_until = '' OR banner_until >= date('now'))
            ORDER BY COALESCE(sent_at, created_at) DESC LIMIT 1`,
      args: [],
    });
    return r.rows[0] || null;
  } catch { return null; }
}
