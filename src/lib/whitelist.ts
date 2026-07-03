// Authorization + auto-provisioning for verified sign-ins. The whitelist ASSIGNS ROLES,
// it does NOT gate who may sign in: any verified email gets an account (name captured from
// the OAuth profile) with a base `user` role. The env superadmin (SITE_ADMIN_EMAIL) and any
// elevated row in the D1 `users` table override that base role. Disabled rows are blocked.
// Deps: queries (users table), runtime-env (reads CF secret at request time — NOT build time).
import { getUserByEmail, createUser, updateUser } from './queries';
import { getEnv } from './runtime-env';

export type Resolved = { id: string; email: string; role: string; name: string };

function newUserId(): string {
  try { return `usr_${(globalThis.crypto as any).randomUUID()}`; } catch {}
  return `usr_${Math.random().toString(36).slice(2)}${Date.now().toString(36)}`;
}

/**
 * Resolve a verified email to a user, provisioning one if needed.
 * @returns the user (base `user` role if not whitelisted), or null only if explicitly disabled.
 */
export async function resolveUserByEmail(rawEmail: string, profile: { name?: string } = {}): Promise<Resolved | null> {
  const email = (rawEmail || '').trim().toLowerCase();
  if (!email) return null;
  const name = (profile.name || '').trim();

  // Superadmin is defined by config (secret read at request time), always superadmin.
  const envEmail = getEnv('SITE_ADMIN_EMAIL')?.trim().toLowerCase();
  const isSuperadmin = !!envEmail && email === envEmail;

  // Existing row: honor its role (unless superadmin), block if disabled, capture name if missing.
  const existing = await getUserByEmail(email).catch(() => null);
  if (existing) {
    if (!existing.active) return null; // disabled = explicitly revoked → blocked
    if (name && !existing.name) await updateUser(existing.id, { name }).catch(() => {});
    return {
      id: existing.id,
      email: existing.email,
      role: isSuperadmin ? 'superadmin' : existing.role,
      name: existing.name || name,
    };
  }

  // No row yet: provision. Superadmin → superadmin; everyone else → base `user`.
  const role = isSuperadmin ? 'superadmin' : 'user';
  const id = newUserId();
  const created = await createUser({ id, email, name, role }).catch(() => null);
  if (created) return { id: created.id, email: created.email, role, name: created.name || name };

  // DB write failed — never lock out the superadmin over an infra hiccup.
  if (isSuperadmin) return { id, email, role: 'superadmin', name: name || 'Superadmin' };
  return null;
}
