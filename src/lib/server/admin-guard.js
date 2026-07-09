// Admin guard for /api/* routes. The middleware only gates /admin/* page loads, so API
// endpoints must validate the session cookie themselves. Reuse the same Lucia session.
import { lucia } from '../auth';

const STAFF = ['superadmin', 'admin', 'editor', 'author'];

// Returns the authenticated staff user, or null. Accepts an Astro API context
// ({ cookies, request }). Also honors an Authorization: Bearer <token> header
// (used by fetch-based admin JS), matching src/pages/api/admin/comments.ts.
export async function getAdmin(context, roles = STAFF) {
  let sessionId = context?.cookies?.get(lucia.sessionCookieName)?.value ?? null;
  if (!sessionId) {
    const auth = context?.request?.headers?.get('Authorization') || '';
    sessionId = auth.replace(/^Bearer\s+/i, '').trim() || null;
  }
  if (!sessionId) return null;
  try {
    const { user } = await lucia.validateSession(sessionId);
    if (!user || !roles.includes(user.role)) return null;
    return user;
  } catch {
    return null;
  }
}

// Convenience: throw-style 303 redirect back to the referring admin page with an error flag.
export function seeOther(location) {
  return new Response(null, { status: 303, headers: { Location: location } });
}
