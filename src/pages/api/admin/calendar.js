// Calendar admin actions: save/update/delete a calendar_item, and set the Airbnb listing URL.
// Form-POST from /admin/calendar. Staff-only. Bumps the events edge-cache token so the public
// /calendar (and /events) reflect changes immediately.
export const prerender = false;
import { getAdmin, seeOther } from '@lib/server/admin-guard';
import { upsertCalendarItem, deleteCalendarItem, getCalendarItem, setOption, setCalendarOverride, deleteCalendarOverride } from '@lib/queries';
import { refreshAirbnbBlocks } from '@lib/airbnb';
import { env as cfEnv } from 'cloudflare:workers';

const BACK = '/admin/calendar';
const clamp = (s, n) => String(s || '').slice(0, n).trim();

async function bumpEventsCache() {
  // Same token the middleware keys /events* on; bumping it flushes the public calendar cache.
  // KV is a binding object — read it off the cloudflare:workers env, not getEnv() (which stringifies).
  try { await (cfEnv && cfEnv.SESSION)?.put?.('edge:events:v', String(Date.now())); } catch {}
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

  // Quick label/link/hide from the unified manager list. Custom items update in place; auto
  // entries (events, Airbnb) get a layered override keyed by their calendar id.
  if (op === 'label') {
    const key = clamp(form.get('entry_key'), 200);
    if (!key) return seeOther(`${BACK}?error=key#manage`);
    const kind = clamp(form.get('entry_kind'), 20);
    const label = clamp(form.get('label'), 200);
    const link = clamp(form.get('link_url'), 500);
    const hidden = form.has('hidden');
    if (kind === 'item') {
      const item = await getCalendarItem(key);
      if (item) {
        await upsertCalendarItem({
          id: key, title: label || item.title, type: item.type, start: item.start, end: item.end,
          allDay: item.allDay, location: item.location, linkUrl: link, color: item.color,
          notes: item.notes, visible: !hidden, createdBy: admin.email || admin.id || null,
        });
      }
    } else if (!label && !link && !hidden) {
      await deleteCalendarOverride(key); // nothing set → drop the override, revert to source
    } else {
      await setCalendarOverride(key, { label, linkUrl: link, hidden });
    }
    await bumpEventsCache();
    return seeOther(`${BACK}?saved=1#manage`);
  }

  // save (create or update) a custom calendar item
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
    allDay: form.has('all_day'),
    location: clamp(form.get('location'), 200),
    linkUrl: clamp(form.get('link_url'), 500),
    color: clamp(form.get('color'), 20),
    notes: clamp(form.get('notes'), 2000),
    visible: form.has('visible'),
    createdBy: admin.email || admin.id || null,
  });
  await bumpEventsCache();
  return seeOther(`${BACK}?saved=1`);
};
