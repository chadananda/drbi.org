// Request-scoped Cloudflare D1 accessor with a libsql-compatible execute()/batch() shim.
// The D1 binding (env.DB) is injected per-request by middleware via setD1() — there is NO
// module-scope I/O, because Cloudflare Workers forbid async I/O / random in global scope.
// Existing callers use db.execute('SELECT ...') or db.execute({ sql, args }) unchanged.

type D1PreparedStatement = any;
type D1Database = {
  prepare(sql: string): { bind(...args: any[]): D1PreparedStatement };
  batch(stmts: D1PreparedStatement[]): Promise<any[]>;
};

type Query = string | { sql: string; args?: any[] };

let _d1: D1Database | null = null;

/** Called by middleware at the start of each request with locals.runtime.env.DB. */
export function setD1(binding: D1Database | undefined | null) {
  if (binding) _d1 = binding;
}

/** Whether a D1 binding has been injected for this request/isolate. */
export function hasD1() {
  return _d1 !== null;
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
  return _d1!.prepare(sql).bind(...args);
}

export const db = {
  async execute(q: Query) {
    if (!_d1) throw new Error('D1 binding not initialized — setD1() was not called for this request');
    return toResult(await (prep(q) as any).all());
  },
  async batch(list: Query[]) {
    if (!_d1) throw new Error('D1 binding not initialized — setD1() was not called for this request');
    const res = await _d1.batch(list.map(prep));
    return res.map(toResult);
  },
};
