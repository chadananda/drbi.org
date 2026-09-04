// Pure token/rate-limit helpers — no database, no bindings, so this is unit
// testable under plain node. src/lib/server/api-tokens.js and rate-limit.js
// build the D1-backed behaviour on top. Deps: Web Crypto (global in Workers and node 24).

export const TOKEN_PREFIX = 'drbi_';
export const PREFIX_LEN = 12; // chars of the random half kept as the public lookup key

// Role ladder. A token satisfies a requirement if it sits at or above it.
export const ROLES = ['author', 'editor', 'admin', 'superadmin'];

export function roleAtLeast(role, required) {
  const a = ROLES.indexOf(role);
  const b = ROLES.indexOf(required);
  return a >= 0 && b >= 0 && a >= b;
}

export const isWellFormed = (token) =>
  typeof token === 'string' &&
  token.startsWith(TOKEN_PREFIX) &&
  token.length >= TOKEN_PREFIX.length + PREFIX_LEN;

// The non-secret half, safe to log and to store in the clear.
export const tokenPrefix = (token) =>
  isWellFormed(token) ? token.slice(TOKEN_PREFIX.length, TOKEN_PREFIX.length + PREFIX_LEN) : null;

export function newToken() {
  const raw = [...crypto.getRandomValues(new Uint8Array(32))]
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return TOKEN_PREFIX + raw;
}

export async function sha256Hex(input) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Constant-time compare of two equal-length hex strings.
export function hashesMatch(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// A token row is usable only if it is neither revoked nor past its expiry.
export function isExpired(row, now = new Date()) {
  if (!row) return true;
  if (row.revoked_at) return true;
  if (row.expires_at) {
    const raw = String(row.expires_at);
    // D1 datetime('now') has no timezone marker; treat bare values as UTC.
    const stamp = /[Zz]|[+-]\d{2}:?\d{2}$/.test(raw) ? raw : raw.replace(' ', 'T') + 'Z';
    if (new Date(stamp).getTime() < now.getTime()) return true;
  }
  return false;
}

// ─── rate limiting ───────────────────────────────────────────────────────────

export const DEFAULT_LIMIT = 120; // requests
export const DEFAULT_WINDOW = 60; // seconds

export const windowStart = (nowMs, windowSec = DEFAULT_WINDOW) =>
  Math.floor(nowMs / 1000 / windowSec) * windowSec;

export const bucketKey = (id, start) => `${id}:${start}`;

// Drop anything not explicitly allowed, so a caller can never set columns like
// `id` or `created_at` by sending extra JSON.
export function pick(body, allowed) {
  const out = {};
  if (!body || typeof body !== 'object') return out;
  for (const k of allowed) if (body[k] !== undefined) out[k] = body[k];
  return out;
}
