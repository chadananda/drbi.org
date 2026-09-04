// D1-backed bearer tokens for the content API. The plaintext token exists only
// at mint time and in the caller's hands — we persist the SHA-256 and a public
// prefix, so a database leak yields no usable credential.
// Pure helpers live in @lib/api-token-format (unit tested there).
// Deps: @lib/db, @lib/api-token-format.

import { db } from '@lib/db';
import {
  ROLES, roleAtLeast, isWellFormed, tokenPrefix, newToken, sha256Hex, hashesMatch, isExpired,
} from '@lib/api-token-format';

export { ROLES, roleAtLeast, isWellFormed, tokenPrefix, sha256Hex, hashesMatch, isExpired };

// Mint a new token. Returns { token, row } — `token` is shown once and never again.
export async function createApiToken({ name, role = 'editor', createdBy = null, expiresAt = null }) {
  if (!name) throw new Error('A token needs a name');
  if (!ROLES.includes(role)) throw new Error(`Unknown role: ${role}`);
  const token = newToken();
  const id = crypto.randomUUID();
  await db.execute({
    sql: `INSERT INTO api_tokens (id, prefix, token_hash, name, role, created_by, expires_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [id, tokenPrefix(token), await sha256Hex(token), name, role, createdBy, expiresAt],
  });
  return { token, row: { id, name, role, prefix: tokenPrefix(token) } };
}

// Verify a presented token. Returns the row or null. One indexed read, then a
// constant-time hash comparison.
export async function verifyApiToken(token) {
  if (!isWellFormed(token)) return null;
  const { rows } = await db.execute({
    sql: `SELECT * FROM api_tokens WHERE prefix = ? LIMIT 1`,
    args: [tokenPrefix(token)],
  });
  const row = rows?.[0];
  if (!row) return null;
  if (!hashesMatch(await sha256Hex(token), row.token_hash)) return null;
  if (isExpired(row)) return null;
  return row;
}

// Best-effort usage stamp; never blocks or fails a request.
export async function touchApiToken(id) {
  try {
    await db.execute({
      sql: `UPDATE api_tokens SET last_used_at = datetime('now') WHERE id = ?`,
      args: [id],
    });
  } catch { /* a missed timestamp must not break the call */ }
}

export async function listApiTokens() {
  const { rows } = await db.execute(
    `SELECT id, prefix, name, role, created_at, created_by, last_used_at, expires_at, revoked_at
       FROM api_tokens ORDER BY created_at DESC`,
  );
  return rows ?? [];
}

export async function revokeApiToken(id) {
  await db.execute({
    sql: `UPDATE api_tokens SET revoked_at = datetime('now') WHERE id = ? AND revoked_at IS NULL`,
    args: [id],
  });
}
