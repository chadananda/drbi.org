// Public waitlist signup for a full event. POSTed by the waitlist form on /events/[slug] (same
// origin, so Astro's CSRF check passes). No auth — it's a public form. Stores name/email/phone/party.
export const prerender = false;
import { addWaitlist } from '@lib/server/event-waitlist';
import { getEventById } from '@lib/queries';

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });

export const POST = async ({ request }) => {
  let body;
  try { body = await request.json(); }
  catch { return json({ ok: false, error: 'Bad request' }, 400); }

  const eventId = String(body.eventId || '');
  if (!eventId) return json({ ok: false, error: 'Missing event' }, 400);
  // Only accept waitlist entries for events that exist (avoids junk rows for arbitrary ids).
  const ev = await getEventById(eventId);
  if (!ev) return json({ ok: false, error: 'Event not found' }, 404);

  const res = await addWaitlist({
    eventId,
    name: body.name,
    email: body.email,
    phone: body.phone,
    partySize: body.partySize,
  });
  if (!res) return json({ ok: false, error: 'Please enter your name and a valid email.' }, 400);
  return json({ ok: true, duplicate: !!res.duplicate });
};
