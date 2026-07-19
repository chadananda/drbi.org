// Per-event internal coordination thread (meals/volunteers/logistics). D1 access.
// DRBI-only, unrelated to Humanitix sync. Any signed-in team member reads + posts.
import { db } from '@lib/db';

const MAX_BODY = 4000;

// All messages for one event, oldest first.
export async function listThread(eventId) {
  if (!eventId) return [];
  try {
    const r = await db.execute({
      sql: 'SELECT id, event_id, user_id, author_name, body, created_at FROM event_thread WHERE event_id = ? ORDER BY created_at ASC, id ASC',
      args: [eventId],
    });
    return r.rows.map(row => ({
      id: row.id, eventId: row.event_id, userId: row.user_id,
      author: row.author_name || 'Team member', body: row.body, createdAt: row.created_at,
    }));
  } catch { return []; }
}

// Message counts keyed by event_id, for the whole list in one query (badge on each card).
export async function threadCounts() {
  try {
    const r = await db.execute('SELECT event_id, COUNT(*) AS n FROM event_thread GROUP BY event_id');
    const out = {};
    for (const row of r.rows) out[row.event_id] = Number(row.n) || 0;
    return out;
  } catch { return {}; }
}

// Append a message. Returns the created row (or null on invalid input).
export async function addMessage({ eventId, userId = null, authorName = '', body = '' }) {
  const text = String(body || '').trim().slice(0, MAX_BODY);
  if (!eventId || !text) return null;
  const now = new Date().toISOString();
  const r = await db.execute({
    sql: 'INSERT INTO event_thread (event_id, user_id, author_name, body, created_at) VALUES (?,?,?,?,?)',
    args: [eventId, userId, String(authorName || '').slice(0, 120), text, now],
  });
  return { id: r.lastInsertRowid, eventId, userId, author: authorName || 'Team member', body: text, createdAt: now };
}

// Delete a message. Callers enforce who may delete (author or admin).
export async function deleteMessage(id) {
  try { await db.execute({ sql: 'DELETE FROM event_thread WHERE id = ?', args: [Number(id)] }); } catch {}
}
