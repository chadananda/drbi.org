export const prerender = false;
// :arch: per-event REST resource — GET / PATCH / DELETE /api/events/{id}. Writes are manual-only.
// :why: clean resource endpoints for the internal API (Claude Code / scripts). Static sibling
//       ./waitlist.js wins its path, so [id] only catches real ids.
// :rules: PATCH/DELETE 403 on any non-'manual' (Humanitix-synced) event — those stay read-only.
//         Content edits go through updateEvent; capacity/waitlist through setEventMeta.
import { getEventById, updateEvent, deleteEvent, setEventMeta } from "../../../lib/queries";
import { getAdmin } from "../../../lib/server/admin-guard";
import { pickEventContent, pickEventMeta, validateEventInput } from "../../../lib/event-input.js";
import { eventSlug } from "../../../lib/event-slug.js";

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
const withSlug = (event) => ({ ...event, slug: eventSlug(event), url: `/events/${eventSlug(event)}` });

export const GET = async (context) => {
  const admin = await getAdmin(context);
  if (!admin) return json({ ok: false, error: 'Unauthorized' }, 401);
  const event = await getEventById(context.params.id);
  if (!event) return json({ ok: false, error: 'Event not found' }, 404);
  return json({ ok: true, event: withSlug(event) });
};

export const PATCH = async (context) => {
  const admin = await getAdmin(context, ['superadmin', 'admin']);
  if (!admin) return json({ ok: false, error: 'Unauthorized' }, 401);
  const existing = await getEventById(context.params.id);
  if (!existing) return json({ ok: false, error: 'Event not found' }, 404);
  if (existing.data.source && existing.data.source !== 'manual')
    return json({ ok: false, error: 'This event is managed on Humanitix. Edit it there — the website only controls hide/show.' }, 403);
  let body;
  try { body = await context.request.json(); }
  catch { return json({ ok: false, error: 'Invalid JSON body' }, 400); }
  const errors = validateEventInput(body, { partial: true });
  if (errors.length) return json({ ok: false, errors }, 422);
  try {
    const content = pickEventContent(body);
    if (Object.keys(content).length) await updateEvent(context.params.id, { ...content, sponsorPageUrl: body.sponsorPageUrl });
    const meta = pickEventMeta(body);
    if (Object.keys(meta).length) {
      const cur = existing.data;
      await setEventMeta(context.params.id, {
        capacity: meta.capacity !== undefined ? meta.capacity : cur.capacity,
        waitlistOverride: meta.waitlistOverride !== undefined ? meta.waitlistOverride : cur.waitlistOverride,
      });
    }
    const event = await getEventById(context.params.id);
    return json({ ok: true, event: withSlug(event) });
  } catch (error) {
    console.error('PATCH /api/events/[id] error:', error);
    return json({ ok: false, error: 'Error updating event' }, 500);
  }
};

export const DELETE = async (context) => {
  const admin = await getAdmin(context, ['superadmin', 'admin']);
  if (!admin) return json({ ok: false, error: 'Unauthorized' }, 401);
  const existing = await getEventById(context.params.id);
  if (!existing) return json({ ok: false, error: 'Event not found' }, 404);
  if (existing.data.source && existing.data.source !== 'manual')
    return json({ ok: false, error: 'This event is managed on Humanitix and cannot be deleted from the website.' }, 403);
  try {
    await deleteEvent(context.params.id);
    return json({ ok: true, deleted: context.params.id });
  } catch (error) {
    console.error('DELETE /api/events/[id] error:', error);
    return json({ ok: false, error: 'Error deleting event' }, 500);
  }
};
