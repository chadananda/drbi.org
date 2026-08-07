// Poll PayPal for open (sent-but-unpaid) invoices and update their status/paid amount in D1.
// Called in the background from the admin events page load, and on demand via the endpoint.
import { listOpenInvoices, updateInvoiceStatus } from '@lib/server/event-invoices';
import { getInvoice } from '@lib/server/paypal';

export async function refreshOpenInvoices(limit = 20) {
  const open = await listOpenInvoices(limit);
  let changed = 0;
  for (const inv of open) {
    try {
      const { status, paidCents } = await getInvoice(inv.paypalInvoiceId);
      if (status && (status !== inv.status || paidCents !== inv.paidCents)) {
        await updateInvoiceStatus(inv.id, { status, paidCents });
        changed++;
      }
    } catch { /* leave this invoice as-is; try again next pass */ }
  }
  return { checked: open.length, changed };
}
