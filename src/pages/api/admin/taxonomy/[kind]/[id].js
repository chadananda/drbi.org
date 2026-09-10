// Single tag: GET / PATCH / DELETE /api/admin/taxonomy/{categories|topics}/{id}
export const prerender = false;
import { db } from '@lib/db';
import { updateCategory, deleteCategory, updateTopic, deleteTopic } from '@lib/queries';
import { itemHandlers } from '@lib/server/api-resource';
import { apiError } from '@lib/server/admin-guard';
import { KINDS, validateTaxonomy } from '../[kind].js';

// Rows are addressed by id, which for these tables is normally the slug.
const OPS = {
  categories: { table: 'categories', update: updateCategory, remove: deleteCategory },
  topics: { table: 'topics', update: updateTopic, remove: deleteTopic },
};

const getRow = (table) => async (id) => {
  const { rows } = await db.execute({
    // security-audit-ignore: dangerous-pattern — table comes from the two-key OPS whitelist, never from input; id is bound
    sql: `SELECT * FROM ${table} WHERE id = ? OR slug = ? LIMIT 1`,
    args: [id, id],
  });
  return rows?.[0] ?? null;
};

async function dispatch(context, method) {
  const kind = context.params?.kind;
  const spec = KINDS[kind];
  const ops = OPS[kind];
  if (!spec || !ops) return apiError(404, 'Unknown taxonomy', `Expected one of: ${Object.keys(KINDS).join(', ')}`);
  const handlers = itemHandlers({
    fields: spec.fields,
    validate: validateTaxonomy(kind),
    get: getRow(ops.table),
    update: (id, data) => ops.update(id, data),
    remove: (id) => ops.remove(id),
  });
  return handlers[method](context);
}

export const GET = (context) => dispatch(context, 'GET');
export const PATCH = (context) => dispatch(context, 'PATCH');
export const DELETE = (context) => dispatch(context, 'DELETE');
