// src/middleware.ts
import { lucia } from "./lib/auth";
import { verifyRequestOrigin as verifyOrig } from "lucia";
import { ADMIN_NAV, roleLevel } from "./lib/admin-nav";
import { env } from "cloudflare:workers";
import { revalidateEventsIfStale } from "./lib/humanitix-sync";
import { maybeSendDue } from "./lib/server/newsletters";
// import { defineMiddleware } from "astro:middleware";

// Security headers applied to every response.
// CSP is report-only so it cannot break inline scripts/GIS — safe to add immediately.
function applySecurityHeaders(headers: Headers): void {
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  headers.set('X-Frame-Options', 'SAMEORIGIN');
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  headers.set(
    'Content-Security-Policy-Report-Only',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://accounts.google.com https://apis.google.com https://gsi.cloudflare.com https://static.cloudflareinsights.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://accounts.google.com",
      "font-src 'self' https://fonts.gstatic.com",
      "img-src 'self' data: https://ik.imagekit.io https://cdn.shrtr.com https://lh3.googleusercontent.com https://res.cloudinary.com https://images.humanitix.com https://img.youtube.com https://i.ytimg.com",
      "connect-src 'self' https://accounts.google.com https://apis.google.com https://static.cloudflareinsights.com",
      "frame-src https://accounts.google.com",
      "object-src 'none'",
      "base-uri 'self'",
    ].join('; ')
  );
}

// Public event pages are edge-cached for anonymous visitors. Entries are keyed by a
// content-version token (`edge:events:v` in KV) that the Humanitix sync bumps only on a
// real change — so a change invalidates every colo's cache at once, while unchanged polls
// leave the cache intact. Logged-in users bypass entirely (their navbar is personalized).
const EVENTS_CACHE = /^\/events(?:\/|$)/;


export const onRequest = async (context, next) => {
  // DB bindings are read directly from `cloudflare:workers` env in src/lib/db.ts
  // (Astro v6+ removed Astro.locals.runtime.env).
  const url = new URL(context.request.url);
  const path = url.pathname;
  const isAdmin = path.startsWith('/admin');
  const STAFF = ['superadmin', 'admin', 'editor', 'author'];

  // Validate the session on EVERY page so the navbar can show login/account state
  // anywhere. Sign-in happens via the navbar popover — there is no login page.
  const sessionId = context.cookies.get(lucia.sessionCookieName)?.value ?? null;

  // --- Stale-while-revalidate: refresh event content from Humanitix as a side effect of
  // traffic. Runs before the cache return so even a cache HIT can drive a background refresh.
  // Serves instantly; only touches D1 + flushes the cache if Humanitix actually changed. ---
  if (context.request.method === 'GET' && EVENTS_CACHE.test(path)) {
    await revalidateEventsIfStale(context.locals.cfContext);
  }

  // Traffic-driven scheduled-newsletter processor (self-throttled via KV, ~once/3min).
  // Runs on admin loads too so a scheduled send fires even on low public traffic.
  if (context.request.method === 'GET') { await maybeSendDue(); }

  // --- Edge cache: anonymous GET of public HTML pages (fast TTFB). Events are keyed by the
  // content-version token so a Humanitix change flushes them; other pages key by path and
  // rely on the short s-maxage to pick up code deploys. Logged-in users always bypass. ---
  const isEventsPath = EVENTS_CACHE.test(path);
  const cacheable = context.request.method === 'GET' && !sessionId && !url.searchParams.has('nocache')
    && !path.startsWith('/admin') && !path.startsWith('/api') && path !== '/login'
    && !/\.[a-z0-9]{2,5}$/i.test(path); // skip asset-like paths (served/cached by the CDN)
  let cache: any, cacheKey: any;
  if (cacheable && typeof caches !== 'undefined') {
    try {
      cache = (caches as any).default;
      const v = isEventsPath ? ((await (env as any).SESSION?.get('edge:events:v')) || '0') : 'p';
      cacheKey = new Request(`https://edge.cache${path}?v=${v}`);
      const hit = await cache.match(cacheKey);
      if (hit) {
        const h = new Response(hit.body, hit);
        applySecurityHeaders(h.headers);
        return h;
      }
    } catch { cache = undefined; cacheKey = undefined; }
  }
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

  const response = await next();
  applySecurityHeaders(response.headers);

  // Store anonymous 200 HTML for the current content version. Browser TTL is 0 (always
  // revalidate against the edge) so a version bump is picked up on the next request.
  if (cache && cacheKey && response.status === 200 && !response.headers.has('set-cookie')) {
    try {
      const bodyBuf = await response.clone().arrayBuffer();
      const headers = new Headers(response.headers);
      headers.delete('set-cookie');
      // Short edge TTL so code deploys propagate quickly; content changes still flush
      // instantly via the version token. (Long TTLs held stale HTML across deploys.)
      headers.set('Cache-Control', 'public, max-age=0, s-maxage=120');
      headers.set('x-edge-cache', 'HIT'); // present only when later served from cache
      await cache.put(cacheKey, new Response(bodyBuf, { status: 200, headers }));
    } catch {}
  }
  return response;
};

export const config = {
  matcher: ['/admin/*', '/login'] // Apply this middleware to '/admin/*' and '/login'
};
