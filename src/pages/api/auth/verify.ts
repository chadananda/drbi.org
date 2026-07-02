// GET /api/auth/verify?token=...  — verify magic-link token, start session, go to /admin.
export const prerender = false;

import type { APIRoute } from 'astro';
import { jwtVerify } from 'jose';
import { resolveUserByEmail } from '@lib/whitelist';
import { startSession } from '@lib/session';
import { requireEnv } from '@lib/runtime-env';

const secret = () => new TextEncoder().encode(requireEnv('PRIVATE_JWT_SECRET'));

export const GET: APIRoute = async (context) => {
  const { request } = context;
  const token = new URL(request.url).searchParams.get('token') || '';
  try {
    const { payload } = await jwtVerify(token, secret());
    if (payload.purpose !== 'magic' || !payload.email) throw new Error('bad token');

    const user = await resolveUserByEmail(String(payload.email));
    if (!user) return context.redirect('/login?error=not-authorized', 303);

    await startSession(context, user.id, user.role);
    return context.redirect('/admin', 303);
  } catch (e) {
    console.error('verify error:', e);
    return context.redirect('/login?error=invalid-or-expired', 303);
  }
};
