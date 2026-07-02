// POST /api/auth/request-link  { email }
// If the email is whitelisted, email a signed magic-link. Always responds { ok: true }
// (never reveal whether an email is whitelisted).
export const prerender = false;

import type { APIRoute } from 'astro';
import { SignJWT } from 'jose';
import { resolveUserByEmail } from '@lib/whitelist';
import { sendEmail } from '@lib/email';
import { requireEnv } from '@lib/runtime-env';

const secret = () => new TextEncoder().encode(requireEnv('PRIVATE_JWT_SECRET'));

export const POST: APIRoute = async ({ request }) => {
  try {
    const { email } = await request.json().catch(() => ({}));
    const clean = (email || '').trim().toLowerCase();
    const ok = /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/.test(clean);
    if (!ok) return new Response(JSON.stringify({ ok: true }), { status: 200 });

    const user = await resolveUserByEmail(clean);
    if (user) {
      const token = await new SignJWT({ email: clean, purpose: 'magic' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('15m')
        .sign(secret());
      const origin = new URL(request.url).origin;
      const link = `${origin}/api/auth/verify?token=${encodeURIComponent(token)}`;
      await sendEmail({
        to: clean,
        subject: 'Your DRBI admin sign-in link',
        html: `<p>Click to sign in to the DRBI admin. This link expires in 15 minutes.</p>
               <p><a href="${link}" style="display:inline-block;padding:10px 18px;background:#3b82f6;color:#fff;border-radius:6px;text-decoration:none">Sign in</a></p>
               <p style="color:#666;font-size:12px">If you didn't request this, ignore this email.</p>`,
        text: `Sign in to DRBI admin (expires in 15 min): ${link}`,
      });
    }
    // Uniform response regardless of whitelist status.
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  } catch (e) {
    console.error('request-link error:', e);
    // Still return ok to avoid leaking; the user just won't get an email.
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  }
};
