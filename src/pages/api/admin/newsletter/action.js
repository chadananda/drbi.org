// Newsletter actions: save, schedule, sendnow, test, delete. Form-POST from the admin page.
export const prerender = false;
import { getAdmin, seeOther } from '@lib/server/admin-guard';
import { upsertNewsletter, deleteNewsletter, getNewsletter, sendNewsletter, wrapEmail } from '@lib/server/newsletters';
import { removeSubscriber } from '@lib/server/subscribers';
import { sendEmail, bodyToHtml } from '@lib/email';

const BACK = '/admin/newsletter';
const clamp = (s, n) => String(s || '').slice(0, n);

export const POST = async (context) => {
  const { request } = context;
  const admin = await getAdmin(context);
  if (!admin) return new Response('Unauthorized', { status: 403 });

  const form = await request.formData();
  const op = String(form.get('op') || '');
  const id = form.get('id') ? Number(form.get('id')) : null;

  if (op === 'delete') { await deleteNewsletter(id); return seeOther(`${BACK}?deleted=1`); }
  if (op === 'unsubscribe') { await removeSubscriber(Number(form.get('sub_id'))); return seeOther(`${BACK}?removed=1`); }

  const subject = clamp(form.get('subject'), 200).trim();
  const body = clamp(form.get('body'), 60000).trim();

  if (op === 'save') {
    const savedId = await upsertNewsletter({ id, subject, body, status: 'draft' });
    return seeOther(`${BACK}?saved=1&edit=${savedId}`);
  }

  if (op === 'schedule') {
    if (!subject || !body) return seeOther(`${BACK}?e=empty`);
    const local = String(form.get('send_at') || '').trim();
    if (!local) return seeOther(`${BACK}?e=nodate`);
    // datetime-local is wall-clock; store as ISO UTC.
    const iso = new Date(local).toISOString();
    const savedId = await upsertNewsletter({ id, subject, body, status: 'scheduled', send_at: iso });
    return seeOther(`${BACK}?scheduled=1&edit=${savedId}`);
  }

  if (op === 'test') {
    if (!subject || !body) return seeOther(`${BACK}?e=empty`);
    try {
      await sendEmail({ to: admin.email, subject: `[TEST] ${subject}`, html: wrapEmail(subject, bodyToHtml(body)), text: body });
      return seeOther(`${BACK}?tested=1`);
    } catch { return seeOther(`${BACK}?e=testfail`); }
  }

  if (op === 'sendnow') {
    if (!subject || !body) return seeOther(`${BACK}?e=empty`);
    const savedId = await upsertNewsletter({ id, subject, body, status: 'draft' });
    const nl = await getNewsletter(savedId);
    const sent = await sendNewsletter(nl);
    return seeOther(`${BACK}?sent=${sent}`);
  }

  return seeOther(BACK);
};

export const GET = () => new Response('Method Not Allowed', { status: 405 });
