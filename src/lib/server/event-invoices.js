// Per-event accommodation invoices (PayPal). DRBI-internal metadata on the event — never touches
// Humanitix/sync. amount_cents/paid_cents are integers; status mirrors the PayPal invoice status.
import { db } from '@lib/db';

const clamp = (s, n) => String(s ?? '').trim().slice(0, n);
const PAID_STATUSES = ['PAID', 'MARKED_AS_PAID'];
const CLOSED_STATUSES = [...PAID_STATUSES, 'CANCELLED', 'REFUNDED'];

// Insert a sent invoice. amountCents is a positive integer. Returns { id } or null on bad input.
export async function addEventInvoice({ eventId, name, email, accommodation, amountCents, currency = 'USD', paypalInvoiceId, status = 'SENT', paymentUrl, sentAt }) {
  const ev = clamp(eventId, 128);
  const nm = clamp(name, 160);
  const em = clamp(email, 200).toLowerCase();
  const cents = Math.round(Number(amountCents));
  if (!ev || !nm || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em) || !Number.isFinite(cents) || cents <= 0) return null;
  const id = crypto.randomUUID();
  try {
    await db.execute({
      sql: `INSERT INTO event_invoices (id, event_id, name, email, accommodation, amount_cents, currency, paypal_invoice_id, status, payment_url, sent_at)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      args: [id, ev, nm, em, clamp(accommodation, 500), cents, currency, paypalInvoiceId || null, status, paymentUrl || null, sentAt || new Date().toISOString()],
    });
    return { id };
  } catch { return null; }
}

const shape = (row) => ({
  id: row.id, eventId: row.event_id, name: row.name, email: row.email,
  accommodation: row.accommodation, amountCents: Number(row.amount_cents) || 0,
  currency: row.currency || 'USD', paypalInvoiceId: row.paypal_invoice_id,
  status: row.status, paymentUrl: row.payment_url, paidCents: Number(row.paid_cents) || 0,
  sentAt: row.sent_at, paidAt: row.paid_at, createdAt: row.created_at,
  paid: PAID_STATUSES.includes(row.status),
});

// All invoices for one event, newest first.
export async function listEventInvoices(eventId) {
  if (!eventId) return [];
  try {
    const r = await db.execute({
      sql: 'SELECT * FROM event_invoices WHERE event_id = ? ORDER BY created_at DESC, id DESC',
      args: [eventId],
    });
    return r.rows.map(shape);
  } catch { return []; }
}

// Billed/paid totals for every event, as a Map(eventId → { billedCents, paidCents, count, openCount }).
export async function invoiceTotalsByEvent() {
  const map = new Map();
  try {
    const r = await db.execute({
      sql: `SELECT event_id,
                   COUNT(*) AS count,
                   COALESCE(SUM(amount_cents),0) AS billed,
                   COALESCE(SUM(CASE WHEN status IN ('PAID','MARKED_AS_PAID') THEN amount_cents ELSE paid_cents END),0) AS paid,
                   SUM(CASE WHEN status IN ('PAID','MARKED_AS_PAID','CANCELLED','REFUNDED') THEN 0 ELSE 1 END) AS open_count
            FROM event_invoices GROUP BY event_id`,
      args: [],
    });
    for (const row of r.rows) {
      map.set(row.event_id, {
        billedCents: Number(row.billed) || 0,
        paidCents: Number(row.paid) || 0,
        count: Number(row.count) || 0,
        openCount: Number(row.open_count) || 0,
      });
    }
  } catch {}
  return map;
}

// Invoices that still need a status check (sent but not yet paid/closed).
export async function listOpenInvoices(limit = 40) {
  try {
    const placeholders = CLOSED_STATUSES.map(() => '?').join(',');
    const r = await db.execute({
      sql: `SELECT * FROM event_invoices WHERE paypal_invoice_id IS NOT NULL AND status NOT IN (${placeholders}) ORDER BY created_at ASC LIMIT ?`,
      args: [...CLOSED_STATUSES, limit],
    });
    return r.rows.map(shape);
  } catch { return []; }
}

// Update an invoice's status after polling PayPal. Stamps paid_at when it first becomes paid.
export async function updateInvoiceStatus(id, { status, paidCents }) {
  try {
    const paidAt = PAID_STATUSES.includes(status) ? new Date().toISOString() : null;
    await db.execute({
      sql: `UPDATE event_invoices
            SET status = ?, paid_cents = ?, paid_at = COALESCE(paid_at, ?)
            WHERE id = ?`,
      args: [status, Math.round(Number(paidCents) || 0), paidAt, id],
    });
  } catch {}
}

export async function deleteEventInvoice(id) {
  try { await db.execute({ sql: 'DELETE FROM event_invoices WHERE id = ?', args: [String(id)] }); } catch {}
}
