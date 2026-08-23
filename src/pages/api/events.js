export const prerender = false;
// :arch: public + admin events API. GET lists events; POST creates a manual (free) event.
//        Per-event GET/PATCH/DELETE live in ./events/[id].js. Humanitix events are read-only.
// :why: extends the internal content-CRUD API (see /api/posts) so Claude Code can manage
//       non-ticketed events without a redeploy — writes hit D1 and are live immediately.
// :rules: writes only ever create source='manual'. Auth via getAdmin (cookie / API token /
//         Bearer JWT). Legacy {action,...} POST (admin UI, sessionid-in-body) kept working.
import { lucia } from "../../lib/auth";
import {
  getVisibleEvents, getUpcomingEvents, getEvents, getEventById,
  createEvent, updateEvent, deleteEvent, toggleEventVisibility, setEventMeta,
} from "../../lib/queries";
import { getAdmin } from "../../lib/server/admin-guard";
import { pickEventContent, pickEventMeta, validateEventInput } from "../../lib/event-input.js";
import { eventSlug } from "../../lib/event-slug.js";

const json = (o, status = 200, headers = {}) =>
  new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json', ...headers } });

export const GET = async (context) => {
  try {
    const url = new URL(context.request.url);
    const wantAll = ['1', 'true'].includes(url.searchParams.get('all') || '');
    const source = url.searchParams.get('source');
    if (wantAll) {
      const admin = await getAdmin(context);
      if (!admin) return json({ ok: false, error: 'Unauthorized' }, 401);
      let events = await getEvents();
      if (source) events = events.filter(e => e.data.source === source);
      return json(events, 200, { 'Cache-Control': 'private, no-store' });
    }
    let events = url.searchParams.get('upcoming') ? await getUpcomingEvents() : await getVisibleEvents();
    if (source) events = events.filter(e => e.data.source === source);
    return json(events, 200, { 'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300' });
  } catch (error) {
    console.error('GET /api/events error:', error);
    return json({ ok: false, error: 'Error retrieving events' }, 500);
  }
};

export const POST = async (context) => {
  let body;
  try { body = await context.request.json(); }
  catch { return json({ ok: false, error: 'Invalid JSON body' }, 400); }
  // Legacy action-based path (admin UI: create/update/delete/toggle-visibility, sessionid in body).
  if (body && body.action !== undefined) return legacyDispatch(body);
  // Clean REST create — cookie / API-token / Bearer-JWT auth.
  const admin = await getAdmin(context, ['superadmin', 'admin']);
  if (!admin) return json({ ok: false, error: 'Unauthorized' }, 401);
  const errors = validateEventInput(body);
  if (errors.length) return json({ ok: false, errors }, 422);
  try {
    const slug = eventSlug({ data: { title: body.title, name: body.name, startDate: body.startDate } });
    const clash = (await getEvents()).find(e => eventSlug(e) === slug);
    if (clash) return json({ ok: false, error: 'An event with this title and year already exists', conflictSlug: slug, conflictId: clash.id }, 409);
    const created = await createEvent({ ...pickEventContent(body), source: 'manual' });
    const meta = pickEventMeta(body);
    if (Object.keys(meta).length) await setEventMeta(created.id, { capacity: meta.capacity ?? null, waitlistOverride: meta.waitlistOverride ?? null });
    const event = await getEventById(created.id);
    return json({ ok: true, id: event.id, slug, url: `/events/${slug}`, event }, 201);
  } catch (error) {
    console.error('POST /api/events (create) error:', error);
    return json({ ok: false, error: 'Error creating event' }, 500);
  }
};

// ─── Legacy action dispatch (admin UI) — auth via sessionid in the JSON body ──────────────
async function legacyDispatch(body) {
  const { action, eventData, sessionid } = body;
  if (!sessionid) return json({ ok: false, error: 'Session ID required' }, 401);
  const { user } = await lucia.validateSession(sessionid);
  if (!user) return json({ ok: false, error: 'Invalid session' }, 401);
  if (!['superadmin', 'admin'].includes(user.role)) return json({ ok: false, error: 'Access denied' }, 403);
  try {
    if (action === 'create') {
      if (!eventData?.title || !eventData?.startDate) return json({ ok: false, error: 'Title and start date are required' }, 400);
      const created = await createEvent({ ...pickEventContent(eventData), source: 'manual' });
      return json({ success: true, eventId: created.id });
    }
    if (action === 'update') {
      if (!eventData?.id) return json({ ok: false, error: 'Event ID required' }, 400);
      const existing = await getEventById(eventData.id);
      if (!existing) return json({ ok: false, error: 'Event not found' }, 404);
      if (existing.data.source && existing.data.source !== 'manual')
        return json({ success: false, error: 'This event is managed on Humanitix. Edit it there — the website only controls hide/show.' }, 403);
      await updateEvent(eventData.id, { ...pickEventContent(eventData), sponsorPageUrl: eventData.sponsorPageUrl });
      return json({ success: true });
    }
    if (action === 'delete') {
      if (!eventData?.id) return json({ ok: false, error: 'Event ID required' }, 400);
      await deleteEvent(eventData.id);
      return json({ success: true });
    }
    if (action === 'toggle-visibility') {
      if (!eventData?.id) return json({ ok: false, error: 'Event ID required' }, 400);
      const result = await toggleEventVisibility(eventData.id);
      if (result.blocked) return json({ success: false, blocked: true, visible: false, error: 'This event is not published on Humanitix yet, so it cannot be shown on drbi.org.' });
      return json({ success: true, visible: result.visible });
    }
    return json({ ok: false, error: 'Invalid action' }, 400);
  } catch (error) {
    console.error('POST /api/events (legacy) error:', error);
    return json({ ok: false, error: 'Server error' }, 500);
  }
}
