// src/pages/api/auth/logout.ts
export const prerender = false;

import type { APIRoute } from "astro";

export const GET: APIRoute = async ({ request }) => {
  // Clear the auth_session cookie
  const headers = new Headers();
  headers.append('Set-Cookie', 'auth_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure');
  headers.append('Location', '/');
  return new Response(null, { status: 302, headers });
}

export const POST: APIRoute = async ({ request }) => {
  // Also handle POST requests for logout
  const headers = new Headers();
  headers.append('Set-Cookie', 'auth_session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; Secure');
  headers.append('Location', '/');
  return new Response(null, { status: 302, headers });
}