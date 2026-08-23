// Admin guard for /api/* routes. The middleware only gates /admin/* page loads, so API
// endpoints must validate the session cookie themselves. Reuse the same Lucia session.
import { lucia } from '../auth';
import { getEnv } from '../runtime-env';
import { isApiTokenMatch } from './api-token';

const STAFF = ['superadmin', 'admin', 'editor', 'author'];
// Synthetic identity for the service API token — full superadmin, no personal session.
const API_USER = { id: 'api-token', role: 'superadmin', name: 'API Token', email: 'api@drbi.org' };

// Returns the authenticated staff user, or null. Accepts an Astro API context
// ({ cookies, request }). Cookie first; then a non-interactive credential in the header:
// the service API token (Bearer <API_TOKEN> or X-API-Key), else a Lucia Bearer session JWT.
export async function getAdmin(context, roles = STAFF) {
  let sessionId = context?.cookies?.get(lucia.sessionCookieName)?.value ?? null;
  if (!sessionId) {
    const auth = context?.request?.headers?.get('Authorization') || '';
    const bearer = auth.replace(/^Bearer\s+/i, '').trim() || null;
    const provided = context?.request?.headers?.get('X-API-Key') || bearer;
    // Dedicated service token → superadmin, independent of any user session. getEnv is lazy
    // (request-time), so this is inert until API_TOKEN is set via `wrangler secret put`.
    if (isApiTokenMatch(provided, getEnv('API_TOKEN'))) return API_USER;
    sessionId = bearer;
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
