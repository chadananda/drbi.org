// Pure helpers for mirroring src/data/site.json into D1 and reading it back.
// No database, no bindings, no Astro — unit testable under plain node.
// scripts/ingest-site-content.mjs uses the serialize side; the runtime accessor
// in src/lib/server/site-config.js uses the parse/merge side.
//
// Why a typed key/value table rather than fixed columns: site.json is an
// open-ended bag that grows as the site does, so fixed columns would need a
// migration per new key. But a bare key/value store loses shape — the string
// "true" and the boolean true would both come back as "true", and the nested
// objects (youtube, twitter, podcast) and arrays (languages, post_types) would
// come back as text. Recording value_type keeps the round trip exact.

export const CONFIG_TYPES = ['string', 'number', 'boolean', 'json', 'null'];

/** JS value -> { value, value_type } for storage. */
export function serializeConfigValue(v) {
  if (v === null || v === undefined) return { value: '', value_type: 'null' };
  if (typeof v === 'string') return { value: v, value_type: 'string' };
  if (typeof v === 'number') return { value: String(v), value_type: 'number' };
  if (typeof v === 'boolean') return { value: v ? 'true' : 'false', value_type: 'boolean' };
  return { value: JSON.stringify(v), value_type: 'json' }; // objects and arrays
}

/** { value, value_type } -> JS value. Unknown or malformed types fall back to the raw string. */
export function parseConfigValue(row) {
  if (!row) return undefined;
  const { value, value_type } = row;
  const raw = value ?? '';
  switch (value_type) {
    case 'null':
      return null;
    case 'number': {
      const n = Number(raw);
      return Number.isFinite(n) ? n : raw;
    }
    case 'boolean':
      return raw === 'true';
    case 'json':
      try {
        return JSON.parse(raw);
      } catch {
        return raw; // corrupt JSON must not throw at request time
      }
    case 'string':
    default:
      return raw;
  }
}

/** Whole site.json object -> rows ready for the seed. */
export function configToRows(config) {
  if (!config || typeof config !== 'object') return [];
  return Object.entries(config).map(([key, v]) => ({ key, ...serializeConfigValue(v) }));
}

/** Rows -> a plain object. Later rows win, matching INSERT OR REPLACE semantics. */
export function rowsToConfig(rows) {
  const out = {};
  for (const row of rows ?? []) {
    if (!row?.key) continue;
    out[row.key] = parseConfigValue(row);
  }
  return out;
}

/**
 * A D1 row only overrides the static value when it actually carries something.
 * An empty string with type 'string' is treated as absent: it is far more
 * likely to be a half-finished edit than a deliberate blanking, and silently
 * emptying the site title or address is not a failure mode worth allowing.
 * An explicit null (value_type 'null') IS honoured — site.json itself stores
 * empty strings for unset fields, so this stays faithful to the source.
 */
export function rowOverrides(row) {
  if (!row?.key) return false;
  if (row.value_type === 'null') return true;
  return String(row.value ?? '') !== '';
}

/**
 * The whole read decision, kept pure so it can be tested without D1.
 * `staticConfig` is the build-time import and is always the floor: every key it
 * defines survives, so a missing or empty row can never remove a value.
 * Returns { config, source, overridden } — `overridden` lists the keys D1 supplied.
 */
export function mergeSiteConfig({ staticConfig = {}, rows = null, enabled = false } = {}) {
  const base = { ...staticConfig };
  if (!enabled) return { config: base, source: 'static', overridden: [] };
  if (!Array.isArray(rows) || rows.length === 0) {
    return { config: base, source: 'static', overridden: [] };
  }
  const overridden = [];
  for (const row of rows) {
    if (!rowOverrides(row)) continue;
    base[row.key] = parseConfigValue(row);
    overridden.push(row.key);
  }
  return {
    config: base,
    source: overridden.length ? 'd1' : 'static',
    overridden,
  };
}

/**
 * The whole read decision: fetch, merge, fall back. Pure with respect to the
 * platform — `getRows` is injected — so it is unit testable without D1.
 * src/lib/server/site-config.js wires in the real loader.
 *
 * A lookup that throws is treated as no rows. Site config feeds the navbar,
 * footer, contact details and OG tags, so an unreachable D1 must degrade to the
 * static import and never blank them.
 */
export async function resolveSiteConfig({ staticConfig = {}, getRows, enabled = false } = {}) {
  let rows = null;
  if (enabled && typeof getRows === 'function') {
    try {
      rows = await getRows();
    } catch {
      rows = null;
    }
  }
  return mergeSiteConfig({ staticConfig, rows, enabled });
}
