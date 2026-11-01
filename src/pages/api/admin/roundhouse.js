// Roundhouse community events admin: save/update/delete. Form-POST from /admin/roundhouse.
// Staff-only (authors and up). Bumps the events edge-cache token so /calendar#roundhouse updates at once.
export const prerender = false;
import { getAdmin, seeOther } from '@lib/server/admin-guard';
import { upsertRoundhouseEvent, deleteRoundhouseEvent } from '@lib/queries';
import { env as cfEnv } from 'cloudflare:workers';

const BACK = '/admin/roundhouse';
const clamp = (s, n) => String(s || '').slice(0, n).trim();
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const isTime = (s) => /^\d{2}:\d{2}$/.test(s);

async function bumpEventsCache() {
  try { await (cfEnv && cfEnv.SESSION)?.put?.('edge:events:v', String(Date.now())); } catch {}
}

export const POST = async (context) => {
  const admin = await getAdmin(context, ['superadmin', 'admin', 'editor', 'author', 'coordinator']);
  if (!admin) return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 403, headers: { 'content-type': 'application/json' } });

  const form = await context.request.formData();
  const op = String(form.get('op') || '');

  if (op === 'delete') {
    await deleteRoundhouseEvent(clamp(form.get('id'), 100));
    await bumpEventsCache();
    return seeOther(`${BACK}?deleted=1`);
  }

  const title = clamp(form.get('title'), 200);
  const date = clamp(form.get('date'), 10);
  const startTime = clamp(form.get('start_time'), 5);
  const endTime = clamp(form.get('end_time'), 5);
  const repeatUntil = clamp(form.get('repeat_until'), 10);
  if (!title || !isDate(date)) return seeOther(`${BACK}?error=missing#add`);
  if ((startTime && !isTime(startTime)) || (endTime && !isTime(endTime))) return seeOther(`${BACK}?error=time#add`);

  const id = await upsertRoundhouseEvent({
    id: clamp(form.get('id'), 100) || undefined,
    title, date, startTime, endTime,
    repeat: form.get('repeat') === 'weekly' ? 'weekly' : 'none',
    repeatUntil: isDate(repeatUntil) ? repeatUntil : '',
    organizer: clamp(form.get('organizer'), 200),
    notes: clamp(form.get('notes'), 1000),
    visible: !form.has('hidden'),
    createdBy: admin.email || admin.id || null,
  });
  await bumpEventsCache();
  return seeOther(`${BACK}?saved=${encodeURIComponent(id)}`);
};
