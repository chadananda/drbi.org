// Announcement actions: save (+ autosave), test, send, delete. Form-POST from the admin page.
export const prerender = false;
import { getAdmin, seeOther } from '@lib/server/admin-guard';
import { getUsers } from '@lib/queries';
import { subscriberEmails } from '@lib/server/subscribers';
import { upsertAnnouncement, markSent, deleteAnnouncement } from '@lib/server/announcements';
import { sendBulk, bodyToHtml, sendEmail } from '@lib/email';
import { wrapEmail } from '@lib/server/newsletters';

const BACK = '/admin/announcements';
const clamp = (s, n) => String(s || '').slice(0, n);
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });

export const POST = async (context) => {
  const { request } = context;
  const admin = await getAdmin(context);
  if (!admin) return json({ ok: false, error: 'Unauthorized' }, 403);

  const form = await request.formData();
  const op = String(form.get('op') || '');
  const isJson = form.get('json') === '1';
  const id = form.get('id') ? Number(form.get('id')) : null;

  if (op === 'delete') {
    await deleteAnnouncement(id);
    return isJson ? json({ ok: true }) : seeOther(`${BACK}?deleted=1`);
  }

  const subject = clamp(form.get('subject'), 200).trim();
  const body = clamp(form.get('body'), 20000).trim();
  const selected = form.getAll('selected').map((s) => String(s).trim().toLowerCase()).filter(Boolean);
  const includeSubscribers = form.get('include_subscribers') === 'on';
  const banner = form.get('banner') === 'on' ? 1 : 0;
  const banner_tone = form.get('banner_tone') === 'alert' ? 'alert' : 'info';
  const banner_until = String(form.get('banner_until') || '').trim() || null;
  const audience = { selected, includeSubscribers };

  // Save / autosave — always upsert as draft, keep the row id.
  const savedId = await upsertAnnouncement({ id, subject, body, audience, banner, banner_tone, banner_until, status: 'draft' });

  if (op === 'save') {
    return isJson ? json({ ok: true, id: savedId }) : seeOther(`${BACK}?saved=1&edit=${savedId}`);
  }

  if (op === 'test') {
    if (!subject || !body) return seeOther(`${BACK}?e=empty&edit=${savedId}`);
    try {
      await sendEmail({ to: admin.email, subject: `[TEST] ${subject}`, html: wrapEmail(subject, bodyToHtml(body)), text: body });
      return seeOther(`${BACK}?tested=1&edit=${savedId}`);
    } catch {
      return seeOther(`${BACK}?e=testfail&edit=${savedId}`);
    }
  }

  if (op === 'send') {
    if (!subject || !body) return seeOther(`${BACK}?e=empty&edit=${savedId}`);
    let recipients = [...selected];
    if (includeSubscribers) recipients.push(...(await subscriberEmails()));
    recipients = [...new Set(recipients)].slice(0, 1000);
    if (!recipients.length) return seeOther(`${BACK}?e=norecipients&edit=${savedId}`);
    const { sent, total } = await sendBulk({ recipients, subject, html: wrapEmail(subject, bodyToHtml(body)), text: body });
    await markSent(savedId, sent, total);
    return seeOther(`${BACK}?sent=${sent}&of=${total}`);
  }

  return seeOther(BACK);
};

export const GET = () => new Response('Method Not Allowed', { status: 405 });

// Exposed for the admin page loader (kept here so the recipient shape lives with the API).
export async function recipientList() {
  const users = await getUsers().catch(() => []);
  return users
    .filter((u) => u.email && !u.disabled)
    .map((u) => ({ email: String(u.email).toLowerCase(), name: u.name || u.email, role: u.role || 'user' }));
}
