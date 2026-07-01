// Cloudflare D1 accessor with a libsql-compatible execute()/batch() shim.
// Astro v6+ removed Astro.locals.runtime.env; bindings come from the
// `cloudflare:workers` module. Accessing env.DB is lazy (no module-scope I/O);
// actual I/O happens inside execute()/batch() at request time.
// Existing callers use db.execute('SELECT ...') or db.execute({ sql, args }) unchanged.
import { env } from 'cloudflare:workers';

type Query = string | { sql: string; args?: any[] };

function d1(): any {
  const binding = (env as any)?.DB;
  if (!binding) throw new Error('D1 binding "DB" not available on env');
  return binding;
}

// Retained for compatibility with existing imports (e.g. middleware); now a no-op
// since the binding is read directly from cloudflare:workers env.
export function setD1(_binding?: unknown) {}
export function hasD1() {
  return Boolean((env as any)?.DB);
}

function toResult(res: any) {
  const rows = res?.results ?? [];
  return {
    rows,
    columns: rows[0] ? Object.keys(rows[0]) : [],
    rowsAffected: res?.meta?.changes ?? 0,
    lastInsertRowid: res?.meta?.last_row_id,
  };
}

function prep(q: Query) {
  const sql = typeof q === 'string' ? q : q.sql;
  const args = (typeof q === 'string' ? [] : q.args) ?? [];
  return d1().prepare(sql).bind(...args);
}

export const db = {
  async execute(q: Query) {
    return toResult(await prep(q).all());
  },
  async batch(list: Query[]) {
    const res = await d1().batch(list.map(prep));
    return res.map(toResult);
  },
};
