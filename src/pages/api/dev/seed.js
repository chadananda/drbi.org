export const prerender = false;
// :arch: GET /api/dev/seed — sanitized local-dev snapshot, generated live from D1. Whitelisted
//        staff only. Body is replayable SQL (INSERT OR REPLACE) for the local Miniflare DB.
// :why: lets a contributor seed local dev with real, current, PII-free data and ZERO Cloudflare
//       keys — access is the same whitelist/token the site already uses (no obscure public URL).
// :rules: sanitization lives in @lib/dev-seed (public-table whitelist + synthetic PII rows).
//         Auth accepts a durable personal API token (unattended daily pull) OR a session/cookie.
// :deps: @lib/db (D1), @lib/server/api-tokens (verifyApiToken), @lib/server/admin-guard (getAdmin).
import { db } from "../../../lib/db";
import { getAdmin } from "../../../lib/server/admin-guard";
import { verifyApiToken, roleAtLeast, touchApiToken } from "../../../lib/server/api-tokens.js";
import { buildSeedSql, PUBLIC_TABLES } from "../../../lib/dev-seed.js";

// A personal API token (editor+) or any signed-in staff session may pull the seed.
async function authorize(context) {
  const bearer = (context.request.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
  if (bearer) {
    const row = await verifyApiToken(bearer);
    if (row && roleAtLeast(row.role, "editor")) { touchApiToken(row.id); return true; }
  }
  return !!(await getAdmin(context, ["superadmin", "admin", "editor"]));
}

export const GET = async (context) => {
  if (!(await authorize(context))) return new Response("Unauthorized", { status: 401 });
  const fetched = {};
  for (const table of PUBLIC_TABLES) {
    // table names come from a hardcoded whitelist, never user input — safe to interpolate.
    try { const { rows } = await db.execute(`SELECT * FROM ${table}`); fetched[table] = rows || []; }
    catch { fetched[table] = []; } // a table absent locally/remotely must not sink the whole dump
  }
  return new Response(buildSeedSql(fetched), {
    status: 200,
    headers: {
      "Content-Type": "application/sql; charset=utf-8",
      "Cache-Control": "no-store",
      "Content-Disposition": 'attachment; filename="dev-seed.sql"',
    },
  });
};
