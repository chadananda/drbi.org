// Reads site configuration from D1 instead of the build-time src/data/site.json.
//
// OFF by default. Enable with the SITE_CONFIG_FROM_D1 Worker var/secret
// ("1"/"true"). While it is off — and on a missing row, an empty value, or a
// throwing lookup — callers get the static import, which is always the floor.
// Site config feeds the navbar, footer, contact details and every OG tag, so an
// unreachable D1 must never be able to blank them.
//
// Pure helpers live in @lib/site-config-format (unit tested there).
// Deps: @lib/db, @lib/runtime-env, @lib/site-config-format, @data/site.json.

import { db } from '@lib/db';
import { getEnv } from '@lib/runtime-env';
import { resolveSiteConfig } from '@lib/site-config-format';
import staticSite from '@data/site.json';

const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

/** Master switch. Off unless explicitly turned on. */
export function siteConfigFromD1Enabled() {
  return TRUTHY.has(String(getEnv('SITE_CONFIG_FROM_D1') ?? '').toLowerCase());
}

/**
 * Fetch every config row, or null. Never throws: a D1 outage must fall back to
 * the static import rather than surface as a 500.
 */
export async function fetchSiteConfigRows() {
  try {
    const { rows } = await db.execute('SELECT key, value, value_type FROM site_config');
    return rows ?? null;
  } catch {
    return null;
  }
}

/**
 * The site config to render with. Returns a plain object with the same shape as
 * src/data/site.json. `deps` exists so this can be unit tested without D1;
 * production callers pass nothing.
 */
export async function getSiteConfig(deps = {}) {
  const {
    enabled = siteConfigFromD1Enabled(),
    getRows = fetchSiteConfigRows,
    staticConfig = staticSite,
  } = deps;
  const { config } = await resolveSiteConfig({ staticConfig, getRows, enabled });
  return config;
}

/** One key, with the static value as the fallback. */
export async function getSiteValue(key, fallback = undefined, deps = {}) {
  const config = await getSiteConfig(deps);
  return config?.[key] ?? fallback;
}

/** Diagnostics: which keys D1 actually supplied, and whether it was used at all. */
export async function getSiteConfigSource(deps = {}) {
  const {
    enabled = siteConfigFromD1Enabled(),
    getRows = fetchSiteConfigRows,
    staticConfig = staticSite,
  } = deps;
  const { source, overridden } = await resolveSiteConfig({ staticConfig, getRows, enabled });
  return { enabled, source, overridden };
}
