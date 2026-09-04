-- Mirror of src/data/site.json, so site configuration can eventually be edited
-- without a code push. Data only: nothing reads this until SITE_CONFIG_FROM_D1
-- is switched on, and the static import stays the fallback for every key.
--
-- Shape: typed key/value rather than fixed columns. site.json is an open-ended
-- bag that grows with the site, so fixed columns would need a migration per new
-- key. A bare key/value store, though, would lose shape - the string "true" and
-- the boolean true would both read back as "true", and the nested objects
-- (youtube, twitter, facebook, linkedin, podcast) and arrays (languages,
-- post_types) would come back as text. value_type keeps the round trip exact.
--
-- This supersedes the 30 `site.*` rows that 0011 previously wrote into the
-- shared `options` table: one source of truth. Those rows are inert (nothing
-- reads them) and are left in place rather than deleted - pruning production
-- data is Chad's call.
--
-- Idempotent: safe to run more than once.
CREATE TABLE IF NOT EXISTS site_config (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL DEFAULT '',
  -- string | number | boolean | json | null
  value_type TEXT NOT NULL DEFAULT 'string',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_site_config_type ON site_config(value_type);
