// Whitelist authorization. Access = env superadmin (SITE_ADMIN_EMAIL) OR an active
// row in the D1 `users` table (email → role). Passwordless: sign-in methods only need
// to PROVE the email; this decides whether that email is allowed and with what role.
import { getUserByEmail } from './queries';
import { adminUser } from './auth';

export type Resolved = { id: string; email: string; role: string; name: string };

/** Resolve a verified email to a whitelisted user, or null if not allowed. */
export async function resolveUserByEmail(rawEmail: string): Promise<Resolved | null> {
  const email = (rawEmail || '').trim().toLowerCase();
  if (!email) return null;

  // 1. Env superadmin (always allowed, no DB row required)
  const envEmail = import.meta.env.SITE_ADMIN_EMAIL?.trim().toLowerCase();
  if (envEmail && email === envEmail) {
    return { id: adminUser.id, email, role: 'superadmin', name: (adminUser.attributes as any)?.name || 'Superadmin' };
  }

  // 2. Whitelist row in D1 users table
  const dbUser = await getUserByEmail(email).catch(() => null);
  if (dbUser && dbUser.active) {
    return { id: dbUser.id, email: dbUser.email, role: dbUser.role, name: dbUser.name };
  }
  return null;
}
