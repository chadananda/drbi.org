// Per-event coordination thread API. Any signed-in team member (staff) can list + post;
// a message can be deleted by its author or an admin. Not related to Humanitix content.
export const prerender = false;
import { getAdmin } from '@lib/server/admin-guard';
import { listThread, addMessage, deleteMessage } from '@lib/server/event-thread';
import { getEventById } from '@lib/queries';

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });

export const POST = async (context) => {
  const user = await getAdmin(context); // default STAFF = superadmin/admin/editor/author
  if (!user) return json({ ok: false, error: 'Unauthorized' }, 403);

  let body;
  try { body = await context.request.json(); }
  catch { return json({ ok: false, error: 'Bad JSON' }, 400); }

  const op = String(body.op || '');
  const eventId = String(body.eventId || '');

  if (op === 'list') {
    return json({ ok: true, messages: await listThread(eventId) });
  }

  if (op === 'add') {
    if (!eventId || !String(body.body || '').trim()) return json({ ok: false, error: 'Event and message required' }, 400);
    // Guard against threads on unknown events.
    const ev = await getEventById(eventId);
    if (!ev) return json({ ok: false, error: 'Event not found' }, 404);
    const msg = await addMessage({
      eventId, userId: user.id,
      authorName: user.name || user.email || 'Team member',
      body: body.body,
    });
    return msg ? json({ ok: true, message: msg }) : json({ ok: false, error: 'Empty message' }, 400);
  }

  if (op === 'delete') {
    const id = Number(body.id);
    if (!id) return json({ ok: false, error: 'id required' }, 400);
    const isAdmin = ['superadmin', 'admin'].includes(user.role);
    // Author-or-admin: reload the message's owner from the thread to authorize.
    const owned = (await listThread(eventId)).find(m => m.id === id);
    if (!owned) return json({ ok: false, error: 'Not found' }, 404);
    if (!isAdmin && owned.userId !== user.id) return json({ ok: false, error: 'Not allowed' }, 403);
    await deleteMessage(id);
    return json({ ok: true });
  }

  return json({ ok: false, error: 'Unknown op' }, 400);
};
