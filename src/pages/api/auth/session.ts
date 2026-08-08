// Current-session probe for the navbar's client-hydrated account island. Returns the signed-in
// user (or null) so prerendered/edge-cached pages can fill in the per-user button on the client
// without baking any user data into the cached HTML. Never cached (per-user, private).
export const prerender = false;

import type { APIContext } from 'astro';
import { adminNavForRole } from '@lib/admin-nav';

const STAFF = ['superadmin', 'admin', 'editor', 'author'];

export const GET = async ({ locals }: APIContext) => {
  const headers = { 'Content-Type': 'application/json', 'Cache-Control': 'private, no-store' };
  const user: any = locals?.user ?? null;
  if (!user) return new Response(JSON.stringify({ user: null }), { headers });

  const isStaff = STAFF.includes(user.role);
  const roleLabel = String(user.role || '').replace(/^\w/, (c: string) => c.toUpperCase());
  const initials = String(user.name || user.email || '?').trim().split(/\s+/).map((s: string) => s[0]).slice(0, 2).join('').toUpperCase();
  return new Response(JSON.stringify({
    user: { name: user.name || '', email: user.email || '', avatar: user.avatar || '', role: user.role },
    isStaff, roleLabel, initials,
    adminLinks: isStaff ? adminNavForRole(user.role) : [],
  }), { headers });
};
