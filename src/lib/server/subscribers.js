// Newsletter subscribers (D1). Shared by the public subscribe endpoint and the newsletter admin.
import { db } from '../db';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const isEmail = (e) => EMAIL_RE.test(String(e || '').trim());

export async function addSubscriber({ email, name = null, source = 'web', tag = null }) {
  const e = String(email || '').trim().toLowerCase();
  if (!isEmail(e)) return { ok: false, reason: 'invalid' };
  try {
    // Re-subscribe if previously unsubscribed; INSERT OR IGNORE keeps existing rows intact.
    await db.execute({
      sql: `INSERT INTO subscribers (email, name, source, tag) VALUES (?,?,?,?)
            ON CONFLICT(email) DO UPDATE SET unsubscribed=0,
              name=COALESCE(excluded.name, subscribers.name),
              tag=COALESCE(excluded.tag, subscribers.tag)`,
      args: [e, name, source, tag],
    });
    return { ok: true };
  } catch (err) {
    return { ok: false, reason: 'db', error: String(err) };
  }
}

export async function listSubscribers({ activeOnly = true } = {}) {
  try {
    const r = await db.execute(
      activeOnly
        ? 'SELECT * FROM subscribers WHERE unsubscribed = 0 ORDER BY created_at DESC'
        : 'SELECT * FROM subscribers ORDER BY created_at DESC'
    );
    return r.rows;
  } catch { return []; }
}

export async function subscriberEmails(cap = 5000) {
  try {
    const r = await db.execute({
      sql: 'SELECT email FROM subscribers WHERE unsubscribed = 0 ORDER BY created_at ASC LIMIT ?',
      args: [cap],
    });
    return r.rows.map((x) => x.email);
  } catch { return []; }
}

export async function countSubscribers() {
  try {
    const r = await db.execute('SELECT COUNT(*) AS n FROM subscribers WHERE unsubscribed = 0');
    return Number(r.rows[0]?.n || 0);
  } catch { return 0; }
}

export async function unsubscribe(email) {
  try {
    await db.execute({ sql: 'UPDATE subscribers SET unsubscribed = 1 WHERE email = ?', args: [String(email || '').trim().toLowerCase()] });
    return true;
  } catch { return false; }
}

export async function removeSubscriber(id) {
  try { await db.execute({ sql: 'DELETE FROM subscribers WHERE id = ?', args: [id] }); } catch {}
}
