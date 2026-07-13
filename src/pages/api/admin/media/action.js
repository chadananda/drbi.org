// Media metadata actions: update (title/alt/description/tags), delete (D1 + R2 object),
// redescribe (re-run auto-describe). Admin-guarded. JSON in, JSON out.
export const prerender = false;
import { env } from 'cloudflare:workers';
import { getAdmin } from '@lib/server/admin-guard';
import { getMedia, updateMedia, deleteMedia, normalizeTags } from '@lib/server/media';
import { describeImage } from '@lib/server/describe-image';

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });

export const POST = async (context) => {
  const admin = await getAdmin(context);
  if (!admin) return json({ ok: false, error: 'Unauthorized' }, 403);

  let body;
  try { body = await context.request.json(); }
  catch { return json({ ok: false, error: 'Bad JSON' }, 400); }

  const op = String(body.op || '');
  const id = Number(body.id);
  if (!id) return json({ ok: false, error: 'Missing id' }, 400);
  const row = await getMedia(id);
  if (!row) return json({ ok: false, error: 'Not found' }, 404);

  if (op === 'update') {
    await updateMedia(id, {
      title: body.title, alt: body.alt, description: body.description,
      tags: normalizeTags(body.tags),
    });
    return json({ ok: true, media: await getMedia(id) });
  }

  if (op === 'delete') {
    try { if (env?.R2) await env.R2.delete(row.r2_key); } catch { /* orphan tolerated */ }
    await deleteMedia(id);
    return json({ ok: true });
  }

  if (op === 'redescribe') {
    if (!env?.R2) return json({ ok: false, error: 'R2 unavailable' }, 500);
    const provider = body.provider === 'claude' ? 'claude' : 'workers';
    const obj = await env.R2.get(row.r2_key);
    if (!obj) return json({ ok: false, error: 'R2 object missing' }, 404);
    const bytes = await obj.arrayBuffer();
    const meta = await describeImage({ bytes, contentType: row.content_type, filename: row.filename, provider });
    await updateMedia(id, { title: meta.title, alt: meta.alt, description: meta.description, tags: meta.tags });
    return json({ ok: true, media: await getMedia(id), described_by: meta.described_by });
  }

  return json({ ok: false, error: `Unknown op: ${op}` }, 400);
};

export const GET = () => new Response('Method Not Allowed', { status: 405 });
