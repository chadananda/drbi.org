// src/pages/api/auth/logout.ts
export const prerender = false;

import type { APIRoute } from "astro";

// Logout MUST be POST-only. A GET that clears the session gets prefetched by the browser
// (astro prefetchAll) or link-scanners, silently logging admins out. GET is now a harmless
// redirect that does NOT clear the cookie.
export const GET: APIRoute = async () => {
  return new Response(null, { status: 302, headers: { Location: '/' } });
};

export const POST: APIRoute = async () => {
  const headers = new Headers();
  headers.append('Set-Cookie', 'auth_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure; SameSite=Lax');
  headers.append('Location', '/');
  return new Response(null, { status: 302, headers });
};