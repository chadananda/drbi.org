// Per-event email announcement to registrants. Admin-guarded. op=test → send only to the signed-in
// admin; op=send → send to every current registrant's email (from noreply@drbi.org) + log it.
export const prerender = false;
import { getAdmin } from '@lib/server/admin-guard';
import { getEventById } from '@lib/queries';
import { getEnv } from '@lib/runtime-env';
import { fetchHumanitixOrders, fetchHumanitixTickets } from '@lib/humanitix';
import { buildRegistrantRows } from '@lib/event-registrations';
import { sendEmail, sendBulk, bodyToHtml } from '@lib/email';
import { wrapEmail } from '@lib/server/newsletters';
import { recordAnnouncement } from '@lib/server/event-announcements';

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

// Deduped, valid registrant emails for a Humanitix event.
async function registrantEmails(apiKey, extId) {
  const [orders, tickets] = await Promise.all([
    fetchHumanitixOrders(apiKey, extId).catch(() => []),
    fetchHumanitixTickets(apiKey, extId).catch(() => []),
  ]);
  const rows = buildRegistrantRows(tickets, orders, []);
  const set = new Set();
  for (const r of rows) { const e = String(r.email || '').trim().toLowerCase(); if (EMAIL_RE.test(e)) set.add(e); }
  return [...set];
}

export const POST = async (context) => {
  const admin = await getAdmin(context, ['superadmin', 'admin']);
  if (!admin) return json({ ok: false, error: 'Unauthorized' }, 403);

  let body;
  try { body = await context.request.json(); }
  catch { return json({ ok: false, error: 'Bad JSON' }, 400); }

  const op = String(body.op || '');
  const eventId = String(body.eventId || '');
  const subject = String(body.subject || '').trim().slice(0, 300);
  const message = String(body.body || '').trim().slice(0, 20000);
  if (!eventId || !subject || !message) return json({ ok: false, error: 'Subject and message are required.' }, 400);

  const event = await getEventById(eventId);
  if (!event) return json({ ok: false, error: 'Event not found' }, 404);
  const extId = event.data.externalId;
  if (event.data.source !== 'humanitix' || !extId) return json({ ok: false, error: 'Announcements are only available for Humanitix events.' }, 400);

  const html = wrapEmail(subject, bodyToHtml(message));
  const text = message;

  if (op === 'test') {
    const to = admin.email;
    if (!to) return json({ ok: false, error: 'Your account has no email to test to.' }, 400);
    try { await sendEmail({ to, subject: `[TEST] ${subject}`, html, text }); return json({ ok: true, test: true, to }); }
    catch (e) { return json({ ok: false, error: String(e?.message || e) }, 500); }
  }

  if (op === 'send') {
    const apiKey = getEnv('HUMANITIX_API_KEY');
    if (!apiKey) return json({ ok: false, error: 'HUMANITIX_API_KEY not set' }, 500);
    const recipients = await registrantEmails(apiKey, extId);
    if (recipients.length === 0) return json({ ok: false, error: 'No registrant emails found to send to.' }, 400);
    try {
      const { sent, failed, total } = await sendBulk({ recipients, subject, html, text });
      await recordAnnouncement({ eventId, subject, body: message, recipientCount: sent });
      return json({ ok: true, sent, failed, total });
    } catch (e) { return json({ ok: false, error: String(e?.message || e) }, 500); }
  }

  return json({ ok: false, error: 'Unknown op' }, 400);
};
