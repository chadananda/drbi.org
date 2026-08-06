// Save DRBI-internal event metadata: capacity + waitlist override. Admin-guarded. Does NOT set
// manually_edited, so the Humanitix content sync keeps flowing.
export const prerender = false;
import { getAdmin } from '@lib/server/admin-guard';
import { setEventMeta } from '@lib/queries';

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });

export const POST = async (context) => {
  const admin = await getAdmin(context, ['superadmin', 'admin']);
  if (!admin) return json({ ok: false, error: 'Unauthorized' }, 403);
  let body;
  try { body = await context.request.json(); }
  catch { return json({ ok: false, error: 'Bad JSON' }, 400); }

  const id = String(body.eventId || '');
  if (!id) return json({ ok: false, error: 'Missing event' }, 400);
  const capacityRaw = body.capacity;
  const capacity = capacityRaw === '' || capacityRaw == null ? null : Number(capacityRaw);
  if (capacity != null && (!Number.isFinite(capacity) || capacity < 0)) return json({ ok: false, error: 'Capacity must be a non-negative number.' }, 400);
  const waitlistOverride = ['open', 'closed'].includes(body.waitlistOverride) ? body.waitlistOverride : null;

  try {
    const ev = await setEventMeta(id, { capacity, waitlistOverride });
    return json({ ok: true, capacity: ev?.data?.capacity ?? null, waitlistOverride: ev?.data?.waitlistOverride ?? null, registeredCount: ev?.data?.registeredCount ?? 0 });
  } catch (err) {
    return json({ ok: false, error: String(err?.message || err) }, 500);
  }
};
