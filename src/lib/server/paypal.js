// PayPal invoicing (v2 REST). Reusable creation/send/status for DRBI invoices.
// Credentials via getEnv (CF secrets): PAYPAL_CLIENT_ID/SECRET live, *_SANDBOX for dev.
// Dev (astro dev) uses sandbox automatically; the deployed worker uses live.
import { getEnv } from '@lib/runtime-env';

const SANDBOX = import.meta.env?.DEV === true || getEnv('PAYPAL_ENV') === 'sandbox';
const API = SANDBOX ? 'https://api-m.sandbox.paypal.com' : 'https://api-m.paypal.com';

export function paypalEnv() { return SANDBOX ? 'sandbox' : 'live'; }

function credentials() {
  return SANDBOX
    ? { clientId: getEnv('PAYPAL_CLIENT_ID_SANDBOX'), secret: getEnv('PAYPAL_SECRET_SANDBOX') }
    : { clientId: getEnv('PAYPAL_CLIENT_ID'), secret: getEnv('PAYPAL_SECRET') };
}

const INVOICER = {
  name: { given_name: 'Desert Rose', surname: "Bahá'í Institute" },
  phones: [{ country_code: '1', national_number: '5204667961', phone_type: 'MOBILE' }],
  address: { address_line_1: '1950 W. William Sears Dr.', admin_area_2: 'Eloy', admin_area_1: 'AZ', postal_code: '85131', country_code: 'US' },
  website: 'https://drbi.org',
  logo_url: 'https://drbi.org/favicon.png',
};

async function accessToken() {
  const { clientId, secret } = credentials();
  if (!clientId || !secret) throw new Error(`PayPal ${paypalEnv()} credentials not configured`);
  const auth = btoa(`${clientId}:${secret}`);
  const r = await fetch(`${API}/v1/oauth2/token`, {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  if (!r.ok) throw new Error(`PayPal auth failed: ${await r.text()}`);
  return (await r.json()).access_token;
}

const splitName = (full) => {
  const s = String(full || '').trim();
  const i = s.indexOf(' ');
  return i === -1 ? { given_name: s || 'Guest', surname: '' } : { given_name: s.slice(0, i), surname: s.slice(i + 1) };
};

// Create a draft invoice, send it, and return { id, status, paymentUrl }.
export async function createAndSendInvoice({ name, email, itemName, description, amountCents, currency = 'USD', note, dueDays = 30 }) {
  const token = await accessToken();
  const value = (amountCents / 100).toFixed(2);
  const today = new Date().toISOString().split('T')[0];
  const due = new Date(Date.now() + dueDays * 86400000).toISOString().split('T')[0];

  const payload = {
    detail: {
      invoice_date: today,
      currency_code: currency,
      note: note || '',
      payment_term: { term_type: 'DUE_ON_DATE_SPECIFIED', due_date: due },
    },
    invoicer: INVOICER,
    primary_recipients: [{ billing_info: { name: splitName(name), email_address: email } }],
    items: [{
      name: itemName,
      description: description || '',
      quantity: '1',
      unit_amount: { currency_code: currency, value },
      unit_of_measure: 'QUANTITY',
    }],
    configuration: { partial_payment: { allow_partial_payment: false }, allow_tip: false, tax_inclusive: false },
  };

  const createRes = await fetch(`${API}/v2/invoicing/invoices`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: JSON.stringify(payload),
  });
  if (!createRes.ok) throw new Error(`PayPal create failed: ${await createRes.text()}`);
  const invoice = await createRes.json();
  const id = invoice.id;

  const sendRes = await fetch(`${API}/v2/invoicing/invoices/${id}/send`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ send_to_invoicer: true, send_to_recipient: true }),
  });
  if (!sendRes.ok) throw new Error(`PayPal send failed: ${await sendRes.text()}`);

  const details = await getInvoice(id, token);
  return { id, status: details.status, paymentUrl: details.paymentUrl };
}

// Fetch an invoice's current status + paid amount. Returns { status, paidCents, paymentUrl }.
export async function getInvoice(invoiceId, token) {
  const t = token || (await accessToken());
  const r = await fetch(`${API}/v2/invoicing/invoices/${invoiceId}`, {
    method: 'GET',
    headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
  });
  if (!r.ok) throw new Error(`PayPal get failed: ${await r.text()}`);
  const inv = await r.json();
  const paidValue = inv?.payments?.paid_amount?.value ?? inv?.amount_paid?.value ?? '0';
  const paymentUrl =
    inv?.detail?.metadata?.recipient_view_url ||
    inv?.links?.find((l) => l.rel === 'payer-view')?.href ||
    `https://www.paypal.com/invoice/p/#${invoiceId}`;
  return { status: inv.status, paidCents: Math.round(parseFloat(paidValue) * 100), paymentUrl };
}
