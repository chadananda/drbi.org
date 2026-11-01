// Scoped admin roles: roles that may reach only certain /admin sections (e.g. coordinator → Roundhouse).
// Used by middleware after the staff gate. Full staff roles are absent here and unaffected.
export const SCOPED_ROLES = { coordinator: '/admin/roundhouse' };

/** Redirect target if this role may not view this admin path, else null. */
export function scopedAdminRedirect(role, path) {
  const home = SCOPED_ROLES[role];
  if (!home) return null;
  return path === home || path.startsWith(home + '/') ? null : home;
}
