// Tags: categories and topics behind one shape.
// GET/POST /api/admin/taxonomy/categories  |  /api/admin/taxonomy/topics
export const prerender = false;
import { getCategories, createCategory, getTopics, createTopic } from '@lib/queries';
import { collectionHandlers } from '@lib/server/api-resource';
import { apiError } from '@lib/server/admin-guard';

export const KINDS = {
  categories: {
    fields: ['id', 'name', 'slug', 'description', 'image', 'topics'],
    list: getCategories,
    create: createCategory,
    required: 'name',
  },
  topics: {
    fields: ['id', 'topic', 'slug', 'category', 'description', 'traffic'],
    list: getTopics,
    create: createTopic,
    required: 'topic',
  },
};

export function validateTaxonomy(kind) {
  return (data, mode) => {
    const spec = KINDS[kind];
    if (mode === 'create' && !data[spec.required]) return `${spec.required} is required`;
    if (data.slug !== undefined && !/^[a-z0-9-]+$/.test(String(data.slug))) {
      return 'slug must be lowercase letters, numbers and hyphens';
    }
    return null;
  };
}

// The handlers are built per request because the resource depends on [kind].
async function dispatch(context, method) {
  const kind = context.params?.kind;
  const spec = KINDS[kind];
  if (!spec) return apiError(404, 'Unknown taxonomy', `Expected one of: ${Object.keys(KINDS).join(', ')}`);
  const handlers = collectionHandlers({
    fields: spec.fields,
    validate: validateTaxonomy(kind),
    list: () => spec.list(),
    create: (data) => spec.create(data),
  });
  return handlers[method](context);
}

export const GET = (context) => dispatch(context, 'GET');
export const POST = (context) => dispatch(context, 'POST');
