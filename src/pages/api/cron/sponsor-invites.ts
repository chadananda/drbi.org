// Sponsor-a-youth follow-up. For each synced Humanitix event, emails registrants who signed
// up ≥2 days ago and haven't donated/sponsored yet, once each. Secured (Bearer CRON_SECRET);
// run on a schedule. Dormant until HUMANITIX_API_KEY + registrations exist. See docs/humanitix-sponsor.md.
export const prerender = false;

import type { APIRoute } from 'astro';
import { getEnv } from '@lib/runtime-env';
import { fetchHumanitixOrders, shapeOrder, isSponsorInviteEligible } from '@lib/humanitix';
import { getEvents, wasSponsorInvited, recordSponsorInvite } from '@lib/queries';
import { sendEmail } from '@lib/email';

const DELAY_DAYS = 2;
const MAX_PER_RUN = 200; // safety cap against a runaway send

function authorized(request: Request): boolean {
  const secret = getEnv('CRON_SECRET');
  if (!secret) return false;
  const token = (request.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  const qToken = new URL(request.url).searchParams.get('token') ?? '';
  return token === secret || qToken === secret;
}

function inviteHtml(eventTitle: string, name: string, link: string): string {
  const hi = name ? `Hi ${name},` : 'Hello,';
  return `<div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:0 auto;color:#1e293b">
    <p>${hi}</p>
    <p>Thank you for registering for <strong>${eventTitle}</strong>. Not everyone who'd love to attend can afford to — so we wanted to offer you the chance to <strong>sponsor a youth participant</strong> and help a young person take part.</p>
    <p style="text-align:center;margin:28px 0">
      <a href="${link}" style="background:#b45309;color:#fff;text-decoration:none;padding:12px 28px;border-radius:9999px;font-weight:600">Sponsor a youth →</a>
    </p>
    <p style="font-size:12px;color:#64748b">No goods or services are provided in exchange for your contribution. All donations to Desert Rose Bahá'í Institute [FEIN: 86-0916677], a 501(c)(3) not-for-profit organization, are tax deductible to the full extent of the law.</p>
    <p style="font-size:12px;color:#94a3b8">If you'd rather not receive these, just reply and let us know.</p>
  </div>`;
}

const handler: APIRoute = async ({ request }) => {
  if (!authorized(request)) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 401, headers: { 'content-type': 'application/json' } });
  }
  const apiKey = getEnv('HUMANITIX_API_KEY');
  if (!apiKey) {
    return new Response(JSON.stringify({ ok: false, configured: false, error: 'HUMANITIX_API_KEY not set' }), { status: 503, headers: { 'content-type': 'application/json' } });
  }
  // A standalone sponsor donation page (mailing-list link) overrides the per-event link when set.
  const sponsorUrl = getEnv('SPONSOR_DONATION_URL');

  const events = (await getEvents()).filter((e) => e.data.source === 'humanitix' && e.data.externalId);
  const summary = { considered: 0, sent: 0, skipped: 0, events: events.length };

  for (const ev of events) {
    if (summary.sent >= MAX_PER_RUN) break;
    let orders: any[] = [];
    try { orders = await fetchHumanitixOrders(apiKey, ev.data.externalId); } catch { continue; }
    for (const raw of orders) {
      if (summary.sent >= MAX_PER_RUN) break;
      const o = shapeOrder(raw);
      summary.considered++;
      if (!isSponsorInviteEligible(o, { delayDays: DELAY_DAYS })) { summary.skipped++; continue; }
      if (await wasSponsorInvited(o.id)) { summary.skipped++; continue; }
      const link = sponsorUrl || ev.data.registrationUrl || 'https://drbi.org/events';
      try {
        await sendEmail({ to: o.email, subject: `Sponsor a youth participant — ${ev.data.title}`, html: inviteHtml(ev.data.title, o.name, link) });
        await recordSponsorInvite(o.id, ev.data.externalId, o.email);
        summary.sent++;
      } catch { summary.skipped++; }
    }
  }
  return new Response(JSON.stringify({ ok: true, configured: true, ...summary }), { status: 200, headers: { 'content-type': 'application/json' } });
};

export const POST = handler;
export const GET = handler;
