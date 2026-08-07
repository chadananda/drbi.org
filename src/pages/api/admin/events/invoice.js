// Admin: accommodation invoices for an event, via PayPal. op=create sends a real invoice and
// records it; op=list returns an event's invoices; op=refresh polls PayPal for paid status;
// op=delete removes a record (does not void the PayPal invoice). Admin/superadmin only.
export const prerender = false;
import { getAdmin } from '@lib/server/admin-guard';
import { getEventById } from '@lib/queries';
import { getEnv } from '@lib/runtime-env';
import { fetchHumanitixOrders, fetchHumanitixTickets } from '@lib/humanitix';
import { buildRegistrantRows } from '@lib/event-registrations';
import { createAndSendInvoice, paypalEnv } from '@lib/server/paypal';
import { addEventInvoice, listEventInvoices, deleteEventInvoice } from '@lib/server/event-invoices';
import { refreshOpenInvoices } from '@lib/server/invoice-sync';

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

export const POST = async (context) => {
  const admin = await getAdmin(context, ['superadmin', 'admin']);
  if (!admin) return json({ ok: false, error: 'Unauthorized' }, 403);

  let body;
  try { body = await context.request.json(); } catch { return json({ ok: false, error: 'Bad JSON' }, 400); }

  const op = String(body.op || '');
  const eventId = String(body.eventId || '');

  if (op === 'list') {
    return json({ ok: true, invoices: await listEventInvoices(eventId) });
  }

  // Unique registrants (name + email) for the invoice picker — one entry per person.
  if (op === 'registrants') {
    const event = await getEventById(eventId);
    const extId = event?.data?.externalId;
    if (event?.data?.source !== 'humanitix' || !extId) return json({ ok: true, registrants: [] });
    const apiKey = getEnv('HUMANITIX_API_KEY');
    if (!apiKey) return json({ ok: true, registrants: [] });
    try {
      const [orders, tickets] = await Promise.all([
        fetchHumanitixOrders(apiKey, extId).catch(() => []),
        fetchHumanitixTickets(apiKey, extId).catch(() => []),
      ]);
      // Dedupe by person (name + email), not email alone — so two people sharing one booking
      // email both appear, while a single person's duplicate tickets collapse to one entry.
      const seen = new Set();
      const registrants = [];
      for (const r of buildRegistrantRows(tickets, orders, [])) {
        const email = String(r.email || '').trim().toLowerCase();
        if (!EMAIL_RE.test(email)) continue;
        const name = String(r.name || '').trim();
        const key = name.toLowerCase() + '|' + email;
        if (seen.has(key)) continue;
        seen.add(key);
        registrants.push({ name: name || email, email });
      }
      registrants.sort((a, b) => a.name.localeCompare(b.name));
      return json({ ok: true, registrants });
    } catch (e) {
      return json({ ok: true, registrants: [], error: String(e?.message || e) });
    }
  }

  if (op === 'refresh') {
    await refreshOpenInvoices(30);
    return json({ ok: true, invoices: await listEventInvoices(eventId) });
  }

  if (op === 'delete') {
    await deleteEventInvoice(String(body.id || ''));
    return json({ ok: true });
  }

  if (op === 'create') {
    const name = String(body.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const accommodation = String(body.accommodation || '').trim();
    const amount = Number(body.amount);
    if (!eventId || !name) return json({ ok: false, error: 'Name is required.' }, 400);
    if (!EMAIL_RE.test(email)) return json({ ok: false, error: 'A valid email is required.' }, 400);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) return json({ ok: false, error: 'Enter a valid dollar amount.' }, 400);

    const event = await getEventById(eventId);
    if (!event) return json({ ok: false, error: 'Event not found' }, 404);

    const amountCents = Math.round(amount * 100);
    const eventTitle = event.data?.name || event.data?.title || 'DRBI event';
    const note = `Accommodations for ${eventTitle}${accommodation ? ` — ${accommodation}` : ''}.\nDesert Rose Bahá'í Institute, Eloy, Arizona.`;

    try {
      const inv = await createAndSendInvoice({
        name,
        email,
        itemName: `Accommodations — ${eventTitle}`,
        description: accommodation || 'Accommodations at Desert Rose',
        amountCents,
        note,
      });
      const saved = await addEventInvoice({
        eventId, name, email, accommodation, amountCents,
        paypalInvoiceId: inv.id, status: inv.status || 'SENT', paymentUrl: inv.paymentUrl,
      });
      if (!saved) return json({ ok: false, error: 'Invoice sent but failed to record. Check PayPal.' }, 500);
      return json({ ok: true, env: paypalEnv(), invoice: { id: saved.id, paypalInvoiceId: inv.id, status: inv.status, paymentUrl: inv.paymentUrl, amountCents } });
    } catch (e) {
      return json({ ok: false, error: String(e?.message || e) }, 500);
    }
  }

  return json({ ok: false, error: 'Unknown op' }, 400);
};
