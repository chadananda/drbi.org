-- Bearer tokens for the content API, so publishing never needs a code push or a
-- Cloudflare credential. The token itself is NEVER stored — only its SHA-256.
-- `prefix` is the public, non-secret lookup half so verification is one indexed
-- read instead of a table scan.
-- Idempotent: safe to run more than once.
CREATE TABLE IF NOT EXISTS api_tokens (
  id           TEXT PRIMARY KEY,              -- uuid
  prefix       TEXT NOT NULL UNIQUE,          -- public lookup half of the token
  token_hash   TEXT NOT NULL,                 -- sha256 hex of the full token
  name         TEXT NOT NULL,                 -- human label, e.g. "Telahoun content tooling"
  role         TEXT NOT NULL DEFAULT 'editor',-- author | editor | admin | superadmin
  created_at   TEXT NOT NULL DEFAULT (datetime('now')),
  created_by   TEXT,
  last_used_at TEXT,
  expires_at   TEXT,                          -- NULL = no expiry
  revoked_at   TEXT                           -- non-NULL = dead
);
CREATE INDEX IF NOT EXISTS idx_api_tokens_prefix ON api_tokens(prefix);

-- Fixed-window rate limiting for token-authenticated calls. One row per
-- (token, window); old rows are pruned opportunistically on write.
CREATE TABLE IF NOT EXISTS api_rate_limits (
  bucket       TEXT PRIMARY KEY,              -- "<token id>:<window start epoch>"
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_api_rate_limits_window ON api_rate_limits(window_start);
