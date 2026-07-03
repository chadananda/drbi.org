// Single source of truth for admin navigation + role-based visibility.
// Role levels mirror queries.ts: superadmin 100, admin 40, editor 30, author 20, user 10.
export const ROLE_LEVEL: Record<string, number> = { superadmin: 100, admin: 40, editor: 30, author: 20, user: 10 };

export interface AdminNavItem { title: string; href: string; icon: string; minLevel: number; }

export const ADMIN_NAV: AdminNavItem[] = [
  { title: 'Dashboard', href: '/admin',            icon: '🏠', minLevel: 20 },
  { title: 'Content',   href: '/admin/posts',      icon: '📝', minLevel: 20 },
  { title: 'Media',     href: '/admin/media',      icon: '🖼️', minLevel: 20 },
  { title: 'Events',    href: '/admin/events',     icon: '📅', minLevel: 30 },
  { title: 'Comments',  href: '/admin/comments',   icon: '💬', minLevel: 30 },
  { title: 'Categories',href: '/admin/categories', icon: '🏷️', minLevel: 30 },
  { title: 'Topics',    href: '/admin/topics',     icon: '🗂️', minLevel: 30 },
  { title: 'Analytics', href: '/admin/analytics',  icon: '📊', minLevel: 40 },
  { title: 'Team',      href: '/admin/team',       icon: '👥', minLevel: 40 },
  { title: 'Settings',  href: '/admin/settings',   icon: '⚙️', minLevel: 40 },
  { title: 'Users',     href: '/admin/users',      icon: '🔑', minLevel: 100 },
];

export function roleLevel(role: string | undefined | null): number {
  return ROLE_LEVEL[role ?? ''] ?? 0;
}

/** Admin nav items the given role may access. */
export function adminNavForRole(role: string | undefined | null): AdminNavItem[] {
  const level = roleLevel(role);
  return ADMIN_NAV.filter((i) => level >= i.minLevel);
}
