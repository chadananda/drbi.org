// Newsletter data access + send logic (D1 + ZeptoMail). Public-facing broadcast to subscribers.
import { db } from '../db';
import { env } from 'cloudflare:workers';
import { bodyToHtml, sendBulk } from '../email';
import { subscriberEmails, countSubscribers } from './subscribers';

const SEND_CAP = 5000; // safety bound on a single broadcast

export async function listNewsletters() {
  try {
    const r = await db.execute('SELECT * FROM newsletters ORDER BY COALESCE(sent_at, send_at, created_at) DESC');
    return r.rows;
  } catch { return []; }
}

export async function getNewsletter(id) {
  try {
    const r = await db.execute({ sql: 'SELECT * FROM newsletters WHERE id = ?', args: [id] });
    return r.rows[0] || null;
  } catch { return null; }
}

export async function upsertNewsletter({ id, subject, body, status = 'draft', send_at = null }) {
  if (id) {
    await db.execute({
      sql: 'UPDATE newsletters SET subject=?, body=?, status=?, send_at=? WHERE id=?',
      args: [subject, body, status, send_at, id],
    });
    return Number(id);
  }
  const r = await db.execute({
    sql: 'INSERT INTO newsletters (subject, body, status, send_at) VALUES (?,?,?,?)',
    args: [subject, body, status, send_at],
  });
  return Number(r.lastInsertRowid);
}

export async function deleteNewsletter(id) {
  try { await db.execute({ sql: 'DELETE FROM newsletters WHERE id = ?', args: [id] }); } catch {}
}

export async function dueNewsletters(nowIso) {
  try {
    const r = await db.execute({
      sql: `SELECT * FROM newsletters WHERE status='scheduled' AND send_at IS NOT NULL AND send_at <= ? ORDER BY send_at ASC`,
      args: [nowIso],
    });
    return r.rows;
  } catch { return []; }
}

export async function stats() {
  const [subs, r] = await Promise.all([
    countSubscribers(),
    db.execute(`SELECT
        SUM(CASE WHEN status='sent' THEN 1 ELSE 0 END) AS sent,
        SUM(CASE WHEN status='scheduled' THEN 1 ELSE 0 END) AS scheduled,
        SUM(CASE WHEN status='draft' THEN 1 ELSE 0 END) AS drafts
      FROM newsletters`).catch(() => ({ rows: [{}] })),
  ]);
  const row = r.rows[0] || {};
  return { subscribers: subs, sent: Number(row.sent || 0), scheduled: Number(row.scheduled || 0), drafts: Number(row.drafts || 0) };
}

// Send a newsletter to every active subscriber. Marks it sent and records the delivered count.
export async function sendNewsletter(nl) {
  const recipients = await subscriberEmails(SEND_CAP);
  const html = wrapEmail(nl.subject, bodyToHtml(nl.body));
  const text = String(nl.body || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  const { sent } = await sendBulk({ recipients, subject: nl.subject, html, text });
  await db.execute({
    sql: `UPDATE newsletters SET status='sent', sent_at=datetime('now'), sent_count=? WHERE id=?`,
    args: [sent, nl.id],
  });
  return sent;
}

// Minimal branded HTML wrapper so newsletters look intentional in the inbox.
export function wrapEmail(subject, innerHtml) {
  return `<!doctype html><html><body style="margin:0;background:#f5f3ef;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1d1b17;">
  <div style="max-width:600px;margin:0 auto;padding:28px 20px;">
    <div style="text-align:center;padding:8px 0 20px;">
      <div style="font-family:Georgia,'Times New Roman',serif;font-size:20px;letter-spacing:.02em;color:#8a5a22;">Desert Rose Bahá'í Institute</div>
    </div>
    <div style="background:#ffffff;border:1px solid #e7e2d8;border-radius:14px;padding:28px 26px;line-height:1.65;font-size:16px;">
      ${subject ? `<h1 style="font-family:Georgia,serif;font-weight:500;font-size:22px;margin:0 0 16px;color:#1d1b17;">${escapeHtml(subject)}</h1>` : ''}
      <div>${innerHtml}</div>
    </div>
    <div style="text-align:center;color:#8b847a;font-size:12px;padding:18px 10px 0;line-height:1.6;">
      Desert Rose Bahá'í Institute · 1950 W. William Sears Dr., Eloy AZ 85131<br>
      You are receiving this because you subscribed at drbi.org.
    </div>
  </div></body></html>`;
}

function escapeHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// Traffic-driven scheduler: process due scheduled newsletters, self-throttled via KV so at most
// one check runs every few minutes across all requests. Mirrors the events SWR pattern — no
// external cron required. Fail-soft; never blocks the request meaningfully.
export async function maybeSendDue() {
  try {
    const kv = env?.SESSION;
    const now = Date.now();
    if (kv) {
      const last = Number((await kv.get('nl:lastrun')) || 0);
      if (now - last < 180000) return; // 3-minute throttle
      // Claim the slot up front so concurrent requests don't double-send.
      await kv.put('nl:lastrun', String(now), { expirationTtl: 900 });
    }
    const due = await dueNewsletters(new Date().toISOString());
    for (const nl of due) { try { await sendNewsletter(nl); } catch {} }
  } catch {}
}
