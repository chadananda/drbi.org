// Site settings, stored as name/value rows in `options`.
// GET  /api/admin/settings            -> every option
// GET  /api/admin/settings?name=foo   -> one option
// PATCH/POST with {"name":"foo","value":"bar"} or {"settings":{"a":"b",...}}
// Admin-only: settings change site behaviour, so editors cannot write them.
export const prerender = false;
import { db } from '@lib/db';
import { requireApi, apiJson, apiError } from '@lib/server/admin-guard';

const serialise = (v) => (typeof v === 'string' ? v : JSON.stringify(v));

export const GET = async (context) => {
  const gate = await requireApi(context, { role: 'editor' });
  if (gate.response) return gate.response;
  const name = context.url.searchParams.get('name');
  try {
    if (name) {
      const { rows } = await db.execute({ sql: 'SELECT name, value FROM options WHERE name = ?', args: [name] });
      return rows?.[0] ? apiJson({ ok: true, data: rows[0] }) : apiError(404, 'Not found');
    }
    const { rows } = await db.execute('SELECT name, value FROM options ORDER BY name');
    return apiJson({ ok: true, data: rows ?? [] });
  } catch (e) {
    return apiError(500, 'Query failed', String(e?.message ?? e));
  }
};

const write = async (context) => {
  const gate = await requireApi(context, { role: 'admin' });
  if (gate.response) return gate.response;

  let body;
  try { body = await context.request.json(); } catch { return apiError(400, 'Invalid JSON body'); }

  // Accept either a single {name, value} or a {settings:{…}} batch.
  const pairs =
    body && typeof body.settings === 'object' && body.settings
      ? Object.entries(body.settings)
      : body?.name
        ? [[body.name, body.value]]
        : null;
  if (!pairs?.length) return apiError(422, 'Validation failed', 'Send {name, value} or {settings:{…}}.');
  if (pairs.some(([k]) => !k || typeof k !== 'string')) return apiError(422, 'Validation failed', 'Option names must be non-empty strings.');

  try {
    await db.batch(
      pairs.map(([name, value]) => ({
        sql: `INSERT INTO options (name, value) VALUES (?, ?)
              ON CONFLICT(name) DO UPDATE SET value = excluded.value`,
        args: [name, serialise(value ?? '')],
      })),
    );
    return apiJson({ ok: true, updated: pairs.map(([k]) => k) });
  } catch (e) {
    return apiError(500, 'Update failed', String(e?.message ?? e));
  }
};

export const PATCH = write;
export const POST = write;
