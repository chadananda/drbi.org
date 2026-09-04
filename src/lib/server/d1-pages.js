// Serves Markdown page bodies out of the site_pages table instead of the file.
//
// OFF by default. Enable with the PAGES_FROM_D1 Worker var/secret ("1"/"true").
// While it is off — and whenever anything at all goes wrong — the caller falls
// back to the file-backed page, so this can never take a page down.
//
// Only rows with is_route = 1 AND has_components = 0 are eligible: the four MDX
// pages import Astro components (EventCalendar, ImgBlock, CdnImage) that a
// Markdown string cannot express, and they stay on the file path permanently.
//
// Deps: @lib/db, @lib/runtime-env, @lib/page-render.

import { db } from '@lib/db';
import { getEnv } from '@lib/runtime-env';
import { resolvePage } from '@lib/page-render';

const TRUTHY = new Set(['1', 'true', 'yes', 'on']);

/** Master switch. Off unless explicitly turned on. */
export function pagesFromD1Enabled() {
  return TRUTHY.has(String(getEnv('PAGES_FROM_D1') ?? '').toLowerCase());
}

/** Base URL that relative image paths are rewritten against; '' disables them. */
export function pagesCdnBase() {
  return getEnv('PAGES_CDN_BASE') ?? '';
}

/**
 * Fetch an eligible page row, or null. Never throws: a D1 outage must fall back
 * to the file rather than 500 a live page.
 */
export async function getD1Page(route) {
  if (!route) return null;
  try {
    const { rows } = await db.execute({
      sql: `SELECT slug, route, title, label, subtitle, description, image, image_position,
                   body, html, source_path, draft
              FROM site_pages
             WHERE route = ? AND is_route = 1 AND has_components = 0 AND draft = 0
             LIMIT 1`,
      args: [route],
    });
    return rows?.[0] ?? null;
  } catch {
    return null; // unreachable D1 → file fallback
  }
}

/**
 * The whole decision in one call. Returns null to mean "render the file".
 * On success returns { row, html } with relative image paths already absolute.
 *
 * `deps` exists so the loader can be unit tested without D1 or Workers
 * bindings; production callers pass nothing and get the real implementations.
 */
export async function resolveD1Page(route, deps = {}) {
  return resolvePage({
    route,
    getRow: deps.getRow ?? getD1Page,
    enabled: deps.enabled ?? pagesFromD1Enabled(),
    cdnBase: deps.cdnBase ?? pagesCdnBase(),
    debug: deps.debug ?? TRUTHY.has(String(getEnv('PAGES_DEBUG') ?? '').toLowerCase()),
  });
}
