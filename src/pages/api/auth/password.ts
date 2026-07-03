// POST /api/auth/password  { email, password }  — break-glass superadmin login.
// JSON only (Astro CSRF rejects form posts). Env superadmin credentials, read at
// request time via getEnv. Returns { ok, redirect } so the navbar popover can reload.
export const prerender = false;

import type { APIRoute } from 'astro';
import { getEnv } from '@lib/runtime-env';
import { resolveUserByEmail } from '@lib/whitelist';
import { startSession } from '@lib/session';

export const POST: APIRoute = async (context) => {
  const body = await context.request.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '').trim();

  const envEmail = getEnv('SITE_ADMIN_EMAIL')?.trim().toLowerCase();
  const envPassword = getEnv('SITE_ADMIN_PASS')?.trim();

  if (envEmail && envPassword && email === envEmail && password === envPassword) {
    const user = await resolveUserByEmail(email);
    if (user) {
      await startSession(context, user.id, user.role);
      return new Response(JSON.stringify({ ok: true, redirect: '/admin' }), {
        status: 200, headers: { 'content-type': 'application/json' },
      });
    }
  }
  return new Response(JSON.stringify({ ok: false, error: 'invalid' }), {
    status: 401, headers: { 'content-type': 'application/json' },
  });
};
