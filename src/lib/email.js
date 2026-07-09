// ZeptoMail transactional email (Workers-native — plain fetch, no SDK).
// Auth: ZEPTO_SEND_TOKEN. Host: ZEPTO_HOST (default api.zeptomail.com).
import { getEnv } from './runtime-env';

export async function sendEmail({ to, subject, html, text }) {
  const host = (getEnv('ZEPTO_HOST') || 'api.zeptomail.com').replace(/^https?:\/\//, '');
  const token = getEnv('ZEPTO_SEND_TOKEN');
  if (!token) throw new Error('ZEPTO_SEND_TOKEN not set');
  const from = getEnv('EMAIL_FROM') || 'noreply@drbi.org';

  const res = await fetch(`https://${host}/v1.1/email`, {
    method: 'POST',
    headers: {
      Authorization: token.startsWith('Zoho-enczapikey') ? token : `Zoho-enczapikey ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      from: { address: from, name: 'Desert Rose Bahá’í Institute' },
      to: [{ email_address: { address: to } }],
      subject,
      htmlbody: html,
      ...(text ? { textbody: text } : {}),
    }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`ZeptoMail send failed: ${res.status} ${body}`);
  }
  return true;
}

// Turn a plain-text body into safe HTML: escape, auto-link URLs (incl. bare domains),
// keep line breaks. Lets staff type plain text and still get clickable links in email.
const URL_RE = /(?<![@\w.])((?:https?:\/\/|www\.)[^\s<]+|(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?:\/[^\s<]*)?)/gi;
export function plainToHtml(text) {
  const esc = String(text || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const linked = esc.replace(URL_RE, (m) => {
    let url = m, tail = '';
    const t = url.match(/[.,;:!?)\]]+$/); // don't swallow trailing punctuation into the link
    if (t) { tail = t[0]; url = url.slice(0, -tail.length); }
    const href = /^https?:\/\//i.test(url) ? url : 'https://' + url;
    return `<a href="${href}">${url}</a>${tail}`;
  });
  return linked.replace(/\n/g, '<br>');
}

// Detect whether a body is already HTML (has a tag) vs plain text needing conversion.
export function bodyToHtml(body) {
  return /<[a-z][\s\S]*>/i.test(String(body || '')) ? String(body) : plainToHtml(body);
}

// Send one message to many recipients without blocking on individual failures.
// Returns { sent, failed } counts. Each address gets its own send (ZeptoMail single-to).
export async function sendBulk({ recipients, subject, html, text }) {
  const list = [...new Set((recipients || []).map((e) => String(e || '').trim().toLowerCase()).filter(Boolean))];
  const results = await Promise.allSettled(
    list.map((to) => sendEmail({ to, subject, html, text }))
  );
  const sent = results.filter((r) => r.status === 'fulfilled').length;
  return { sent, failed: list.length - sent, total: list.length };
}
