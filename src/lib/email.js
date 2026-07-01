// ZeptoMail transactional email (Workers-native — plain fetch, no SDK).
// Auth: ZEPTO_SEND_TOKEN. Host: ZEPTO_HOST (default api.zeptomail.com).
export async function sendEmail({ to, subject, html, text }) {
  const host = (import.meta.env.ZEPTO_HOST || 'api.zeptomail.com').replace(/^https?:\/\//, '');
  const token = import.meta.env.ZEPTO_SEND_TOKEN;
  if (!token) throw new Error('ZEPTO_SEND_TOKEN not set');
  const from = import.meta.env.EMAIL_FROM || 'noreply@drbi.org';

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
