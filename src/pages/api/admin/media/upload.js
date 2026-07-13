// Media upload: multipart file → R2 (drbi.org/media/<slug>.<ext>) → auto-describe → D1 row.
// Admin-guarded. provider: 'workers' (default, in-app) | 'claude' (developer, needs key).
export const prerender = false;
import { env } from 'cloudflare:workers';
import { getAdmin } from '@lib/server/admin-guard';
import { insertMedia, getMedia, mediaKey, keyToUrl } from '@lib/server/media';
import { describeImage } from '@lib/server/describe-image';

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'Content-Type': 'application/json' } });
const MAX_BYTES = 15 * 1024 * 1024;
const OK_TYPES = /^image\/(webp|jpe?g|png|gif|avif|svg\+xml)$/i;

export const POST = async (context) => {
  const admin = await getAdmin(context);
  if (!admin) return json({ ok: false, error: 'Unauthorized' }, 403);
  if (!env?.R2) return json({ ok: false, error: 'R2 binding unavailable' }, 500);

  let form;
  try { form = await context.request.formData(); }
  catch { return json({ ok: false, error: 'Bad form data' }, 400); }

  const file = form.get('file');
  if (!file || typeof file === 'string' || !file.arrayBuffer) return json({ ok: false, error: 'No file' }, 400);
  const contentType = file.type || 'application/octet-stream';
  if (!OK_TYPES.test(contentType)) return json({ ok: false, error: `Unsupported type: ${contentType}` }, 415);

  const bytes = await file.arrayBuffer();
  if (bytes.byteLength > MAX_BYTES) return json({ ok: false, error: 'File too large (max 15MB)' }, 413);

  const provider = form.get('provider') === 'claude' ? 'claude' : 'workers';
  const width = Number(form.get('width')) || 0;   // measured client-side (naturalWidth)
  const height = Number(form.get('height')) || 0;

  const { base, ext } = mediaKey(file.name || 'image');
  const suffix = (crypto.randomUUID?.() || String(Date.now())).replace(/-/g, '').slice(0, 4);
  const r2_key = `drbi.org/media/${base}-${suffix}.${ext}`;

  try {
    await env.R2.put(r2_key, bytes, { httpMetadata: { contentType } });
  } catch (err) {
    return json({ ok: false, error: `R2 upload failed: ${err?.message || err}` }, 500);
  }

  // Auto-describe (fail-soft — returns filename fallback on error so upload still succeeds).
  const meta = await describeImage({ bytes, contentType, filename: file.name || base, provider });

  const id = await insertMedia({
    r2_key, url: keyToUrl(r2_key), filename: file.name || `${base}.${ext}`,
    title: meta.title, alt: meta.alt, description: meta.description, tags: meta.tags,
    width, height, bytes: bytes.byteLength, content_type: contentType,
    described_by: meta.described_by, uploaded_by: admin.email,
  });

  return json({ ok: true, media: await getMedia(id) });
};

export const GET = () => new Response('Method Not Allowed', { status: 405 });
