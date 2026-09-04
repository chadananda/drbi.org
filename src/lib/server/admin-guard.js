// Admin guard for /api/* routes. The middleware only gates /admin/* page loads, so API
// endpoints must validate the session cookie themselves. Reuse the same Lucia session.
import { lucia } from '../auth';
import { getEnv } from '../runtime-env';
import { isApiTokenMatch } from './api-token';
import { verifyApiToken, touchApiToken, roleAtLeast } from './api-tokens';
import { checkRateLimit, rateLimitHeaders } from './rate-limit';

const STAFF = ['superadmin', 'admin', 'editor', 'author'];
// Synthetic identity for the legacy single-secret API token — full superadmin, no
// personal session. Retained so existing tooling keeps working; prefer D1 tokens.
const API_USER = { id: 'api-token', role: 'superadmin', name: 'API Token', email: 'api@drbi.org' };

// Pull a non-interactive credential out of the request headers.
function presentedToken(context) {
  const auth = context?.request?.headers?.get('Authorization') || '';
  const bearer = auth.replace(/^Bearer\s+/i, '').trim() || null;
  return { bearer, provided: context?.request?.headers?.get('X-API-Key') || bearer };
}

// Returns the authenticated staff user, or null. Accepts an Astro API context
// ({ cookies, request }). Cookie first; then a non-interactive credential in the header:
// a D1-issued content-API token, the legacy service token, else a Lucia Bearer session JWT.
export async function getAdmin(context, roles = STAFF) {
  let sessionId = context?.cookies?.get(lucia.sessionCookieName)?.value ?? null;
  if (!sessionId) {
    const { bearer, provided } = presentedToken(context);

    // D1-issued token: hashed at rest, carries its own role, revocable per token.
    const row = await verifyApiToken(provided);
    if (row) {
      if (!roles.includes(row.role)) return null;
      touchApiToken(row.id);
      return {
        id: `api-token:${row.id}`,
        tokenId: row.id,
        role: row.role,
        name: row.name,
        email: `api+${row.prefix}@drbi.org`,
        isApiToken: true,
      };
    }

    // Legacy single shared secret → superadmin. getEnv is lazy (request-time), so
    // this is inert unless API_TOKEN is set via `wrangler secret put`.
    if (isApiTokenMatch(provided, getEnv('API_TOKEN'))) {
      return roles.includes(API_USER.role) ? { ...API_USER, isApiToken: true } : null;
    }
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

// Guard + rate limit in one call, for the content API. Returns either
// { admin } or { response } — hand the response straight back to the client.
// Only token traffic is metered; a signed-in human is never throttled.
export async function requireApi(context, { role = 'editor', limit } = {}) {
  const admin = await getAdmin(context);
  if (!admin) return { response: apiError(401, 'Unauthorized', 'Provide a valid API token or admin session.') };
  if (!roleAtLeast(admin.role, role)) {
    return { response: apiError(403, 'Forbidden', `This action requires the "${role}" role or higher.`) };
  }
  if (admin.isApiToken) {
    const rl = await checkRateLimit(admin.tokenId || admin.id, limit ? { limit } : undefined);
    if (!rl.allowed) {
      return {
        response: apiError(429, 'Rate limited', 'Too many requests; retry after the window resets.', rateLimitHeaders(rl)),
      };
    }
    return { admin, rateLimit: rl };
  }
  return { admin };
}

export function apiJson(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
  });
}

export function apiError(status, error, detail = undefined, headers = {}) {
  return apiJson({ ok: false, error, ...(detail ? { detail } : {}) }, status, headers);
}

// Convenience: throw-style 303 redirect back to the referring admin page with an error flag.
export function seeOther(location) {
  return new Response(null, { status: 303, headers: { Location: location } });
}
