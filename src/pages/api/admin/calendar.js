// Calendar admin actions: save/update/delete a calendar_item, and set the Airbnb listing URL.
// Form-POST from /admin/calendar. Staff-only. Bumps the events edge-cache token so the public
// /calendar (and /events) reflect changes immediately.
export const prerender = false;
import { getAdmin, seeOther } from '@lib/server/admin-guard';
import { upsertCalendarItem, deleteCalendarItem, setOption } from '@lib/queries';
import { refreshAirbnbBlocks } from '@lib/airbnb';
import { getEnv } from '@lib/runtime-env';

const BACK = '/admin/calendar';
const clamp = (s, n) => String(s || '').slice(0, n).trim();

async function bumpEventsCache() {
  // Same token the middleware keys /events* on; bumping it flushes the public calendar cache.
  try { await getEnv('SESSION')?.put?.('edge:events:v', String(Date.now())); } catch {}
}

export const POST = async (context) => {
  const { request } = context;
  const admin = await getAdmin(context);
  if (!admin) return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 403, headers: { 'content-type': 'application/json' } });

  const form = await request.formData();
  const op = String(form.get('op') || '');

  if (op === 'set-airbnb') {
    await setOption('airbnb_listing_url', clamp(form.get('airbnb_listing_url'), 500));
    const ical = clamp(form.get('airbnb_ical_url'), 1000);
    await setOption('airbnb_ical_url', ical);
    // Pull the feed now so the imported-block count is current on the redirect (best-effort).
    if (ical) { try { await refreshAirbnbBlocks(); } catch {} }
    await bumpEventsCache();
    return seeOther(`${BACK}?saved=airbnb`);
  }

  if (op === 'delete') {
    await deleteCalendarItem(String(form.get('id') || ''));
    await bumpEventsCache();
    return seeOther(`${BACK}?deleted=1`);
  }

  // save (create or update)
  const title = clamp(form.get('title'), 200);
  if (!title) return seeOther(`${BACK}?error=title`);
  const start = clamp(form.get('start'), 40);
  if (!start) return seeOther(`${BACK}?error=start`);

  await upsertCalendarItem({
    id: clamp(form.get('id'), 80) || undefined,
    title,
    type: clamp(form.get('type'), 20) || 'program',
    start,
    end: clamp(form.get('end'), 40) || null,
    allDay: form.get('all_day') !== 'off',
    location: clamp(form.get('location'), 200),
    linkUrl: clamp(form.get('link_url'), 500),
    color: clamp(form.get('color'), 20),
    notes: clamp(form.get('notes'), 2000),
    visible: form.get('visible') !== 'off',
    createdBy: admin.email || admin.id || null,
  });
  await bumpEventsCache();
  return seeOther(`${BACK}?saved=1`);
};
