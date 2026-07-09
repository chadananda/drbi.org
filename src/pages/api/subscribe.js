// Public newsletter signup. Accepts JSON or form POST. Honeypot + light per-IP rate limit
// (KV SESSION namespace). No CAPTCHA dependency — keeps the form frictionless.
export const prerender = false;
import { addSubscriber, isEmail } from '@lib/server/subscribers';
import { env } from 'cloudflare:workers';

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });

async function rateLimited(ip) {
  try {
    const kv = env?.SESSION;
    if (!kv || !ip) return false;
    const key = `sub:rl:${ip}`;
    const n = Number((await kv.get(key)) || 0);
    if (n >= 6) return true;
    await kv.put(key, String(n + 1), { expirationTtl: 60 });
    return false;
  } catch { return false; }
}

export const POST = async ({ request }) => {
  let email = '', website = '', name = null, tag = null;
  const ct = request.headers.get('content-type') || '';
  try {
    if (ct.includes('application/json')) {
      const b = await request.json();
      email = b.email || ''; website = b.website || ''; name = b.name || null; tag = b.tag || null;
    } else {
      const f = await request.formData();
      email = f.get('email') || ''; website = f.get('website') || ''; name = f.get('name') || null; tag = f.get('tag') || null;
    }
  } catch { return json({ ok: false, error: 'bad request' }, 400); }

  // Honeypot: bots fill the hidden "website" field. Pretend success.
  if (website) return json({ ok: true, subscribed: true });
  if (!isEmail(email)) return json({ ok: false, error: 'Please enter a valid email address.' }, 422);

  const ip = request.headers.get('cf-connecting-ip') || request.headers.get('x-forwarded-for') || '';
  if (await rateLimited(ip)) return json({ ok: false, error: 'Too many requests — please try again shortly.' }, 429);

  const res = await addSubscriber({ email, name, source: 'web', tag });
  if (!res.ok) return json({ ok: false, error: 'Could not subscribe right now.' }, 502);
  return json({ ok: true, subscribed: true });
};

export const GET = () => new Response('Method Not Allowed', { status: 405 });
