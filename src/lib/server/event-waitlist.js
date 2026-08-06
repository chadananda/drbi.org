// Public event waitlist (name / email / phone / party size). Filled by the site's waitlist form
// once an event is over capacity; read in the admin below the registrants table. D1 access.
import { db } from '@lib/db';

const clamp = (s, n) => String(s ?? '').trim().slice(0, n);

// Add a waitlist entry. Returns { id } or null on invalid input. Skips an obvious duplicate
// (same event + email within the last hour) to soften double-submits.
export async function addWaitlist({ eventId, name, email, phone, partySize }) {
  const ev = clamp(eventId, 128);
  const nm = clamp(name, 160);
  const em = clamp(email, 200).toLowerCase();
  const ph = clamp(phone, 60);
  const size = Math.min(99, Math.max(1, Math.round(Number(partySize) || 1)));
  if (!ev || !nm || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return null;
  try {
    const dup = await db.execute({
      sql: "SELECT id FROM event_waitlist WHERE event_id = ? AND email = ? AND created_at > datetime('now','-1 hour') LIMIT 1",
      args: [ev, em],
    });
    if (dup.rows.length) return { id: dup.rows[0].id, duplicate: true };
    const r = await db.execute({
      sql: 'INSERT INTO event_waitlist (event_id, name, email, phone, party_size) VALUES (?,?,?,?,?)',
      args: [ev, nm, em, ph, size],
    });
    return { id: r.lastInsertRowid };
  } catch { return null; }
}

// All waitlist entries for an event, oldest first (first-come queue order).
export async function listWaitlist(eventId) {
  if (!eventId) return [];
  try {
    const r = await db.execute({
      sql: 'SELECT id, name, email, phone, party_size, created_at FROM event_waitlist WHERE event_id = ? ORDER BY created_at ASC, id ASC',
      args: [eventId],
    });
    return r.rows.map((row) => ({
      id: row.id, name: row.name, email: row.email, phone: row.phone,
      partySize: Number(row.party_size) || 1, createdAt: row.created_at,
    }));
  } catch { return []; }
}

export async function countWaitlist(eventId) {
  try {
    const r = await db.execute({ sql: 'SELECT COUNT(*) AS n, COALESCE(SUM(party_size),0) AS people FROM event_waitlist WHERE event_id = ?', args: [eventId] });
    return { entries: Number(r.rows[0]?.n) || 0, people: Number(r.rows[0]?.people) || 0 };
  } catch { return { entries: 0, people: 0 }; }
}

export async function deleteWaitlist(id) {
  try { await db.execute({ sql: 'DELETE FROM event_waitlist WHERE id = ?', args: [Number(id)] }); } catch {}
}
