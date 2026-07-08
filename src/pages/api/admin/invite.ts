// POST /api/admin/invite  { email, name?, role }
// Admin-only. Whitelists the email (upserts a users row with the chosen role) and emails a
// magic sign-in link so they can accept. On login, resolveUserByEmail honors the role.
export const prerender = false;

import type { APIRoute } from 'astro';
import { SignJWT } from 'jose';
import { getUserByEmail, createUser, updateUser } from '@lib/queries';
import { sendEmail } from '@lib/email';
import { requireEnv } from '@lib/runtime-env';

const ROLES = ['superadmin', 'admin', 'editor', 'author', 'user'];
const secret = () => new TextEncoder().encode(requireEnv('PRIVATE_JWT_SECRET'));
const newId = () => { try { return `usr_${(globalThis.crypto as any).randomUUID()}`; } catch { return `usr_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`; } };

export const POST: APIRoute = async ({ request, locals }) => {
  const inviter = (locals as any)?.user;
  if (!inviter || !['superadmin', 'admin'].includes(inviter.role)) {
    return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  const body = await request.json().catch(() => ({}));
  const email = String(body.email || '').trim().toLowerCase();
  const name = String(body.name || '').trim();
  const requested = String(body.role || 'editor');
  if (!/^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,})+$/.test(email)) {
    return new Response(JSON.stringify({ ok: false, error: 'Enter a valid email address.' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  // Role guard: never grant superadmin via invite; only a superadmin may grant admin.
  let role = ROLES.includes(requested) ? requested : 'editor';
  if (role === 'superadmin') role = 'admin';
  if (role === 'admin' && inviter.role !== 'superadmin') role = 'editor';

  // Whitelist: upsert the users row with the chosen role.
  try {
    const existing = await getUserByEmail(email).catch(() => null);
    if (existing) {
      await updateUser(existing.id, { role, ...(name && !existing.name ? { name } : {}) });
    } else {
      await createUser({ id: newId(), email, name, role });
    }
  } catch (e) {
    console.error('invite: whitelist upsert failed', e);
    return new Response(JSON.stringify({ ok: false, error: 'Could not save the whitelist entry.' }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }

  // Invitation email with a magic sign-in link (valid 3 days).
  let emailed = false;
  try {
    const token = await new SignJWT({ email, purpose: 'magic' })
      .setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('3d').sign(secret());
    const link = `${new URL(request.url).origin}/api/auth/verify?token=${encodeURIComponent(token)}`;
    const from = inviter.name || 'The DRBI team';
    await sendEmail({
      to: email,
      subject: "You've been invited to the DRBI admin",
      html: `<p>${from} has invited you to help manage the Desert Rose Bahá'í Institute website as <strong>${role}</strong>.</p>
             <p>Click below to sign in and accept. This link is valid for 3 days.</p>
             <p><a href="${link}" style="display:inline-block;padding:11px 20px;background:#8a5a22;color:#fff;border-radius:999px;text-decoration:none;font-weight:600">Accept invitation &amp; sign in</a></p>
             <p style="color:#888;font-size:12px">If you weren't expecting this, you can ignore this email.</p>`,
      text: `${from} invited you to the DRBI admin as ${role}. Sign in (valid 3 days): ${link}`,
    });
    emailed = true;
  } catch (e) {
    console.error('invite: email send failed', e);
  }

  return new Response(JSON.stringify({ ok: true, role, emailed }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
