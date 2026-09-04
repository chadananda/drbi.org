// Shared CRUD wiring for the content API. Each resource supplies its data
// functions and a field whitelist; this handles auth, roles, rate limiting,
// body parsing, and error shape so the endpoint files stay declarative.
// Deps: admin-guard.

import { requireApi, apiJson, apiError } from './admin-guard';
import { pick } from '@lib/api-token-format';

export { pick };

async function readJson(request) {
  try {
    const body = await request.json();
    return body && typeof body === 'object' && !Array.isArray(body) ? body : null;
  } catch {
    return null;
  }
}

/**
 * Build GET/POST handlers for a collection endpoint.
 * `list` receives the URL so it can honour query params; `create` receives the
 * whitelisted body plus the authenticated admin.
 */
export function collectionHandlers({ list, create, fields, readRole = 'author', writeRole = 'editor', validate }) {
  return {
    GET: async (context) => {
      const gate = await requireApi(context, { role: readRole });
      if (gate.response) return gate.response;
      try {
        return apiJson({ ok: true, data: await list(context.url, gate.admin) });
      } catch (e) {
        return apiError(500, 'Query failed', String(e?.message ?? e));
      }
    },
    POST: async (context) => {
      const gate = await requireApi(context, { role: writeRole });
      if (gate.response) return gate.response;
      const body = await readJson(context.request);
      if (!body) return apiError(400, 'Invalid JSON body');
      const data = pick(body, fields);
      const problem = validate?.(data, 'create');
      if (problem) return apiError(422, 'Validation failed', problem);
      try {
        return apiJson({ ok: true, data: await create(data, gate.admin) }, 201);
      } catch (e) {
        return apiError(500, 'Create failed', String(e?.message ?? e));
      }
    },
  };
}

/** Build GET/PATCH/DELETE handlers for a single-item endpoint. */
export function itemHandlers({ get, update, remove, fields, readRole = 'author', writeRole = 'editor', deleteRole = 'admin', validate }) {
  const id = (context) => context.params?.id;
  return {
    GET: async (context) => {
      const gate = await requireApi(context, { role: readRole });
      if (gate.response) return gate.response;
      const row = await get(id(context));
      return row ? apiJson({ ok: true, data: row }) : apiError(404, 'Not found');
    },
    PATCH: async (context) => {
      const gate = await requireApi(context, { role: writeRole });
      if (gate.response) return gate.response;
      const body = await readJson(context.request);
      if (!body) return apiError(400, 'Invalid JSON body');
      const existing = await get(id(context));
      if (!existing) return apiError(404, 'Not found');
      const data = pick(body, fields);
      if (!Object.keys(data).length) return apiError(422, 'Validation failed', 'No writable fields supplied.');
      const problem = validate?.(data, 'update');
      if (problem) return apiError(422, 'Validation failed', problem);
      try {
        await update(id(context), data);
        return apiJson({ ok: true, data: await get(id(context)) });
      } catch (e) {
        return apiError(500, 'Update failed', String(e?.message ?? e));
      }
    },
    DELETE: async (context) => {
      const gate = await requireApi(context, { role: deleteRole });
      if (gate.response) return gate.response;
      const existing = await get(id(context));
      if (!existing) return apiError(404, 'Not found');
      try {
        await remove(id(context));
        return apiJson({ ok: true, deleted: id(context) });
      } catch (e) {
        return apiError(500, 'Delete failed', String(e?.message ?? e));
      }
    },
  };
}
