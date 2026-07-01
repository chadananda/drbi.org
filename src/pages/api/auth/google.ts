// POST /api/auth/google  { credential }  — verify a Google One Tap ID token, start session.
// Verifies signature against Google JWKS, checks audience (client id), issuer, and
// email_verified, then applies the whitelist. Returns { ok, redirect } (client navigates).
export const prerender = false;

import type { APIRoute } from 'astro';
import { jwtVerify, createRemoteJWKSet } from 'jose';
import { resolveUserByEmail } from '@lib/whitelist';
import { startSession } from '@lib/session';

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

export const POST: APIRoute = async (context) => {
  const { request } = context;
  try {
    const clientId = import.meta.env.PUBLIC_GOOGLE_CLIENT_ID;
    if (!clientId) return new Response(JSON.stringify({ ok: false, error: 'Google sign-in not configured' }), { status: 501 });

    const { credential } = await request.json().catch(() => ({}));
    if (!credential) return new Response(JSON.stringify({ ok: false, error: 'missing credential' }), { status: 400 });

    const { payload } = await jwtVerify(credential, GOOGLE_JWKS, {
      issuer: ['https://accounts.google.com', 'accounts.google.com'],
      audience: clientId,
    });

    if (!payload.email || payload.email_verified !== true) {
      return new Response(JSON.stringify({ ok: false, error: 'email not verified' }), { status: 403 });
    }

    const user = await resolveUserByEmail(String(payload.email));
    if (!user) return new Response(JSON.stringify({ ok: false, error: 'not-authorized' }), { status: 403 });

    await startSession(context, user.id, user.role);
    return new Response(JSON.stringify({ ok: true, redirect: '/admin' }), { status: 200 });
  } catch (e) {
    console.error('google auth error:', e);
    return new Response(JSON.stringify({ ok: false, error: 'invalid credential' }), { status: 401 });
  }
};
