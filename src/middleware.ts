// src/middleware.ts
import { lucia } from "./lib/auth";
import { verifyRequestOrigin as verifyOrig } from "lucia";
import { ADMIN_NAV, roleLevel } from "./lib/admin-nav";
// import { defineMiddleware } from "astro:middleware";


export const onRequest = async (context, next) => {
  // DB bindings are read directly from `cloudflare:workers` env in src/lib/db.ts
  // (Astro v6+ removed Astro.locals.runtime.env).
  const path = new URL(context.request.url).pathname;
  const isAdmin = path.startsWith('/admin');
  const STAFF = ['superadmin', 'admin', 'editor', 'author'];

  // Validate the session on EVERY page so the navbar can show login/account state
  // anywhere. Sign-in happens via the navbar popover — there is no login page.
  const sessionId = context.cookies.get(lucia.sessionCookieName)?.value ?? null;
  if (sessionId) {
    try {
      const { session, user } = await lucia.validateSession(sessionId);
      if (session && user) {
        context.locals.session = session;
        context.locals.user = user;
      }
    } catch (error) {
      // Invalid/expired token — clear the cookie and continue as anonymous.
      const sessionCookie = lucia.createBlankSessionCookie();
      context.cookies.set(sessionCookie.name, sessionCookie.value, sessionCookie.attributes);
    }
  }

  // Gate the admin panel on a staff role. Unauthenticated hits go home with the
  // sign-in popover open (?signin=1) rather than to a dedicated login page.
  if (isAdmin) {
    const user = context.locals.user;
    if (!user || !STAFF.includes(user.role)) {
      return new Response(null, { status: 302, headers: { Location: '/?signin=1' } });
    }
    // Per-section role enforcement: only for known admin-nav sections (e.g. /admin/users
    // = superadmin, /admin/team|settings|analytics = admin+). Paths NOT in the matrix
    // (e.g. /admin/articles) stay open to any staff so content editing isn't blocked.
    const match = ADMIN_NAV
      .filter((i) => i.href !== '/admin' && (path === i.href || path.startsWith(i.href + '/')))
      .sort((a, b) => b.href.length - a.href.length)[0];
    if (match && roleLevel(user.role) < match.minLevel) {
      return new Response(null, { status: 302, headers: { Location: '/admin' } });
    }
  }
  return next();
};

export const config = {
  matcher: ['/admin/*', '/login'] // Apply this middleware to '/admin/*' and '/login'
};
