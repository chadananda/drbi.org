// User management API — superadmin only for create/update/delete
export const prerender = false;

import { lucia } from '../../lib/auth';
import { getUsers, getUserById, createUser, updateUser, deleteUser } from '../../lib/queries';
import { Argon2id } from 'oslo/password';

const ROLES = ['superadmin', 'admin', 'editor', 'author'];

async function requireRole(request: Request, minRole: string) {
  const sessionid = request.headers.get('Authorization')?.replace('Bearer ', '').trim()
    ?? new URL(request.url).searchParams.get('sessionid') ?? '';
  if (!sessionid) return { error: 'Session required', status: 401 };
  const { user } = await lucia.validateSession(sessionid);
  if (!user) return { error: 'Invalid session', status: 401 };
  const idx = (r: string) => ROLES.indexOf(r);
  if (idx(user.role) > idx(minRole)) return { error: 'Insufficient permissions', status: 403 };
  return { user };
}

export const GET: import('astro').APIRoute = async ({ request, locals }) => {
  const user = locals?.user;
  if (!user || !['superadmin', 'admin'].includes(user.role)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403 });
  }
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (id) {
    const row = await getUserById(id);
    if (!row) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    const { hashed_password: _, ...safe } = row;
    return new Response(JSON.stringify(safe), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }
  const users = await getUsers();
  return new Response(JSON.stringify(users), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

export const POST: import('astro').APIRoute = async ({ request }) => {
  const auth = await requireRole(request.clone(), 'admin');
  if ('error' in auth) return new Response(auth.error, { status: auth.status });

  const body = await request.json();
  const { name, email, password, role } = body;
  if (!name || !email || !password) {
    return new Response(JSON.stringify({ error: 'name, email and password required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
  const validRole = ROLES.includes(role) ? role : 'author';
  // superadmin can only be set by superadmin
  if (validRole === 'superadmin' && auth.user!.role !== 'superadmin') {
    return new Response(JSON.stringify({ error: 'Only superadmin can create superadmin' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
  }

  const argon = new Argon2id();
  const hashed_password = await argon.hash(password);
  const id = email.toLowerCase().replace(/[^a-z0-9]/g, '-');
  try {
    await createUser({ id, email, hashed_password, name, role: validRole });
    return new Response(JSON.stringify({ success: true, id }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    if (e.message?.includes('UNIQUE')) return new Response(JSON.stringify({ error: 'Email already exists' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    throw e;
  }
};

export const PUT: import('astro').APIRoute = async ({ request }) => {
  const auth = await requireRole(request.clone(), 'admin');
  if ('error' in auth) return new Response(auth.error, { status: auth.status });

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  const body = await request.json();
  const updates: Record<string, any> = {};
  if (body.name) updates.name = body.name;
  if (body.email) updates.email = body.email;
  if (body.role && ROLES.includes(body.role)) {
    if (body.role === 'superadmin' && auth.user!.role !== 'superadmin') {
      return new Response(JSON.stringify({ error: 'Only superadmin can grant superadmin' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }
    updates.role = body.role;
  }
  if (body.active != null) updates.active = body.active;
  if (body.password) {
    const argon = new Argon2id();
    updates.hashed_password = await argon.hash(body.password);
  }

  await updateUser(id, updates);
  const row = await getUserById(id);
  if (!row) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
  const { hashed_password: _, ...safe } = row;
  return new Response(JSON.stringify({ success: true, user: safe }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

export const DELETE: import('astro').APIRoute = async ({ request }) => {
  const auth = await requireRole(request.clone(), 'superadmin');
  if ('error' in auth) return new Response(auth.error, { status: auth.status });

  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) return new Response(JSON.stringify({ error: 'id required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  if (id === auth.user!.id) return new Response(JSON.stringify({ error: 'Cannot delete your own account' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  await deleteUser(id);
  return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};
