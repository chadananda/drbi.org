// Manage content-API tokens. Superadmin only — a token that can mint tokens is
// the keys to the building.
// GET    /api/admin/tokens                 -> list (never includes secrets)
// POST   /api/admin/tokens {name, role}    -> mint; the token is shown ONCE
// DELETE /api/admin/tokens?id=…            -> revoke
export const prerender = false;
import { requireApi, apiJson, apiError } from '@lib/server/admin-guard';
import { listApiTokens, createApiToken, revokeApiToken, ROLES } from '@lib/server/api-tokens';

export const GET = async (context) => {
  const gate = await requireApi(context, { role: 'superadmin' });
  if (gate.response) return gate.response;
  try {
    return apiJson({ ok: true, data: await listApiTokens() });
  } catch (e) {
    return apiError(500, 'Query failed', String(e?.message ?? e));
  }
};

export const POST = async (context) => {
  const gate = await requireApi(context, { role: 'superadmin' });
  if (gate.response) return gate.response;

  let body;
  try { body = await context.request.json(); } catch { return apiError(400, 'Invalid JSON body'); }
  const name = body?.name;
  const role = body?.role ?? 'editor';
  if (!name) return apiError(422, 'Validation failed', 'name is required');
  if (!ROLES.includes(role)) return apiError(422, 'Validation failed', `role must be one of: ${ROLES.join(', ')}`);

  try {
    const { token, row } = await createApiToken({
      name,
      role,
      createdBy: gate.admin.email ?? null,
      expiresAt: body?.expires_at ?? null,
    });
    // The only time the plaintext is ever returned. It is not recoverable later.
    return apiJson(
      { ok: true, token, data: row, warning: 'Copy this token now — it cannot be shown again.' },
      201,
    );
  } catch (e) {
    return apiError(500, 'Create failed', String(e?.message ?? e));
  }
};

export const DELETE = async (context) => {
  const gate = await requireApi(context, { role: 'superadmin' });
  if (gate.response) return gate.response;
  const id = context.url.searchParams.get('id');
  if (!id) return apiError(422, 'Validation failed', 'id query parameter is required');
  try {
    await revokeApiToken(id);
    return apiJson({ ok: true, revoked: id });
  } catch (e) {
    return apiError(500, 'Revoke failed', String(e?.message ?? e));
  }
};
