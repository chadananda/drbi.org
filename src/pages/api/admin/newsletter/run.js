// Process due scheduled newsletters. Callable by (a) an admin session, or (b) a cron caller
// presenting CRON_SECRET via ?key= / ?token= / x-cron-secret. drbi's poorMansCron() pings this
// as a side effect of traffic, so scheduled sends fire without any external scheduler.
export const prerender = false;
import { getAdmin } from '@lib/server/admin-guard';
import { dueNewsletters, sendNewsletter } from '@lib/server/newsletters';
import { getEnv } from '@lib/runtime-env';

async function authorized(context) {
  const { request } = context;
  const url = new URL(request.url);
  const provided = request.headers.get('x-cron-secret') || url.searchParams.get('key') || url.searchParams.get('token') || '';
  const secret = getEnv('CRON_SECRET');
  if (secret && provided && provided === secret) return true;
  return Boolean(await getAdmin(context));
}

async function process(context) {
  if (!(await authorized(context))) return new Response(JSON.stringify({ ok: false, error: 'unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  const now = new Date().toISOString();
  const due = await dueNewsletters(now);
  const done = [];
  for (const nl of due) {
    try { const sent = await sendNewsletter(nl); done.push({ id: nl.id, subject: nl.subject, sent }); }
    catch (e) { done.push({ id: nl.id, subject: nl.subject, error: String(e) }); }
  }
  const total = done.reduce((n, d) => n + (d.sent || 0), 0);
  return new Response(JSON.stringify({ ok: true, processed: due.length, total, done }), { status: 200, headers: { 'Content-Type': 'application/json' } });
}

export const POST = process;
export const GET = process;
