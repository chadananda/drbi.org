// Press-release actions: save (draft), publish, unpublish, delete. Form-POST from the admin page.
export const prerender = false;
import { getAdmin, seeOther } from '@lib/server/admin-guard';
import { upsertRelease, deleteRelease } from '@lib/server/press';

const BACK = '/admin/press';
const clamp = (s, n) => String(s || '').slice(0, n);

export const POST = async (context) => {
  const { request } = context;
  const admin = await getAdmin(context);
  if (!admin) return new Response('Unauthorized', { status: 403 });

  const form = await request.formData();
  const op = String(form.get('op') || '');
  const id = form.get('id') ? Number(form.get('id')) : null;

  if (op === 'delete') { await deleteRelease(id); return seeOther(`${BACK}?deleted=1`); }

  const title = clamp(form.get('title'), 250).trim();
  const dateline = clamp(form.get('dateline'), 120).trim() || null;
  const summary = clamp(form.get('summary'), 1000).trim() || null;
  const body = clamp(form.get('body'), 100000).trim();
  const slug = clamp(form.get('slug'), 120).trim();

  if (!title || !body) return seeOther(`${BACK}?e=empty${id ? `&edit=${id}` : ''}`);

  if (op === 'publish') {
    const savedId = await upsertRelease({ id, title, slug, dateline, summary, body, status: 'published', published_at: new Date().toISOString() });
    return seeOther(`${BACK}?published=1&edit=${savedId}`);
  }
  if (op === 'unpublish') {
    const savedId = await upsertRelease({ id, title, slug, dateline, summary, body, status: 'draft', published_at: null });
    return seeOther(`${BACK}?unpublished=1&edit=${savedId}`);
  }
  // save
  const savedId = await upsertRelease({ id, title, slug, dateline, summary, body, status: 'draft' });
  return seeOther(`${BACK}?saved=1&edit=${savedId}`);
};

export const GET = () => new Response('Method Not Allowed', { status: 405 });
