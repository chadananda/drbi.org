// Per-event email announcements log (what was sent to registrants, when, to how many). D1 access.
import { db } from '@lib/db';

// Past announcements for an event, newest first.
export async function listAnnouncements(eventId) {
  if (!eventId) return [];
  try {
    const r = await db.execute({
      sql: 'SELECT id, subject, body, recipient_count, sent_at, created_at FROM event_announcements WHERE event_id = ? ORDER BY created_at DESC, id DESC',
      args: [eventId],
    });
    return r.rows.map((row) => ({
      id: row.id, subject: row.subject, body: row.body,
      recipientCount: Number(row.recipient_count) || 0, sentAt: row.sent_at, createdAt: row.created_at,
    }));
  } catch { return []; }
}

// Record a sent announcement.
export async function recordAnnouncement({ eventId, subject, body, recipientCount }) {
  const now = new Date().toISOString();
  const r = await db.execute({
    sql: 'INSERT INTO event_announcements (event_id, subject, body, recipient_count, sent_at) VALUES (?,?,?,?,?)',
    args: [eventId, String(subject || '').slice(0, 300), String(body || '').slice(0, 20000), Math.max(0, Math.round(recipientCount) || 0), now],
  });
  return { id: r.lastInsertRowid, sentAt: now };
}
