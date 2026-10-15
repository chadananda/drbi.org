// Content posts API — read from Turso, write via cms-utils (filesystem + Turso sync)
export const prerender = false;

import { requireApi, apiError } from '../../lib/server/admin-guard';
import { env } from 'cloudflare:workers';
import { uploadR2 } from '../../utils/r2-upload.js';
import { guessContentType } from '@utils/utils.js';
import {
  getAllContent,
  getContentByCollection,
  getContentBySlug,
  getContentById,
  createContent,
  updateContent,
  deleteContent,
} from "../../lib/queries";

// Resolve a post's hero image. Accepts either an already-hosted URL
// (frontmatter.image.src) or inline bytes (frontmatter.image.data = base64 or a
// data: URL), which are uploaded to R2 server-side so an agent can publish an
// article and its image in a single call. Returns { src, alt } — src is
// undefined when no image was supplied, so callers can leave existing art alone.
async function resolveImage(frontmatter, slug) {
  const image = frontmatter?.image;
  if (!image) return { src: undefined, alt: undefined };
  const { src, alt = null, data, filename, mimeType } = image;
  if (src) return { src, alt };
  if (data) {
    const b64 = data.includes(',') ? data.split(',')[1] : data;
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    const fname = filename || `${slug}-hero.jpg`;
    const mime = mimeType || guessContentType(fname);
    const url = await uploadR2(env.R2, `uploads/${fname}`, bytes, mime);
    return { src: url, alt };
  }
  return { src: undefined, alt: undefined };
}

// Map Turso content row to the shape cms-utils returns for compatibility
function toPostShape(row) {
  return {
    id: row.id,
    frontmatter: {
      title: row.data?.title ?? '',
      description: row.data?.description ?? '',
      desc_125: row.data?.desc_125 ?? '',
      abstract: row.data?.abstract ?? '',
      post_type: row.data?.post_type ?? '',
      language: row.data?.language ?? 'en',
      draft: row.data?.draft ?? false,
      author: row.data?.author ?? '',
      editor: row.data?.editor ?? '',
      category: row.data?.category ?? '',
      topics: row.data?.topics ?? [],
      keywords: row.data?.keywords ?? [],
      datePublished: row.data?.datePublished ?? null,
      dateModified: row.data?.dateModified ?? null,
      image: row.data?.image_src ? { src: row.data.image_src, alt: row.data.image_alt ?? '' } : null,
      audio: row.data?.audio ?? null,
      narrator: row.data?.narrator ?? null,
    },
    content: row.body ?? '',
    collection: row.collection,
    slug: row.baseid ?? row.id,
  };
}

export async function GET({ request }) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const type = url.searchParams.get('type');
  const search = url.searchParams.get('search');

  try {
    if (id) {
      const row = await getContentById(id);
      if (!row) {
        return new Response(JSON.stringify({ error: 'Post not found' }), {
          status: 404, headers: { 'Content-Type': 'application/json' }
        });
      }
      return new Response(JSON.stringify({ success: true, data: toPostShape(row) }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }

    if (search) {
      const rows = await getAllContent();
      const q = search.toLowerCase();
      const filtered = rows
        .filter(r => (r.data?.title ?? '').toLowerCase().includes(q) || (r.body ?? '').toLowerCase().includes(q))
        .filter(r => !type || r.collection === type);
      return new Response(JSON.stringify({ success: true, data: filtered.map(toPostShape) }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }

    if (type) {
      const collection = type === 'article' ? 'articles' : type;
      const rows = await getContentByCollection(collection);
      return new Response(JSON.stringify({ success: true, data: rows.map(toPostShape) }), {
        status: 200, headers: { 'Content-Type': 'application/json' }
      });
    }

    // All content, sorted by date desc
    const rows = await getAllContent();
    return new Response(JSON.stringify({ success: true, data: rows.map(toPostShape) }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=300',
      }
    });
  } catch (error) {
    console.error('GET /api/posts error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function POST(context) {
  // Cookie session, D1 API token (Authorization: Bearer / X-API-Key), the legacy
  // service token, or a Lucia session JWT — all handled centrally, rate-limited.
  const gate = await requireApi(context, { role: 'author' });
  if (gate.response) return gate.response;

  let body;
  try { body = await context.request.json(); }
  catch { return apiError(400, 'Invalid JSON body'); }
  const { action, ...data } = body;

  try {
    switch (action) {
      case 'create': {
        if (!data.title || !data.content) {
          return new Response(JSON.stringify({ error: 'Title and content required' }), {
            status: 400, headers: { 'Content-Type': 'application/json' }
          });
        }
        const slug = data.slug ?? data.title.toLowerCase().replace(/\s+/g, '-');
        const img = await resolveImage(data.frontmatter, slug);
        const result = await createContent({
          id: data.id ?? slug,
          slug,
          collection: data.type ?? 'articles',
          title: data.title,
          body: data.content,
          description: data.frontmatter?.description ?? '',
          draft: data.frontmatter?.draft ? 1 : 0,
          author: data.frontmatter?.author ?? null,
          topics: data.frontmatter?.topics ?? [],
          keywords: data.frontmatter?.keywords ?? [],
          date_published: data.frontmatter?.datePublished ?? null,
          image_src: img.src ?? null,
          image_alt: img.alt ?? null,
        });
        return new Response(JSON.stringify({ success: true, id: result.id, slug, image: img.src ?? null }), {
          status: 201, headers: { 'Content-Type': 'application/json' }
        });
      }

      case 'delete': {
        if (!data.postId) {
          return new Response(JSON.stringify({ error: 'Post ID required' }), {
            status: 400, headers: { 'Content-Type': 'application/json' }
          });
        }
        await deleteContent(data.postId);
        return new Response(JSON.stringify({ success: true }), {
          status: 200, headers: { 'Content-Type': 'application/json' }
        });
      }

      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), {
          status: 400, headers: { 'Content-Type': 'application/json' }
        });
    }
  } catch (error) {
    console.error('POST /api/posts error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function PUT(context) {
  const url = new URL(context.request.url);
  const id = url.searchParams.get('id');
  if (!id) return apiError(400, 'Post ID required');

  const gate = await requireApi(context, { role: 'author' });
  if (gate.response) return gate.response;

  let body;
  try { body = await context.request.json(); }
  catch { return apiError(400, 'Invalid JSON body'); }
  const data = body;

  try {
    const img = await resolveImage(data.frontmatter, id);
    await updateContent(id, {
      title: data.title,
      body: data.content,
      description: data.frontmatter?.description,
      draft: data.frontmatter?.draft ? 1 : 0,
      author: data.frontmatter?.author,
      topics: data.frontmatter?.topics,
      keywords: data.frontmatter?.keywords,
      date_published: data.frontmatter?.datePublished,
      date_modified: new Date().toISOString(),
      image_src: img.src,
      image_alt: img.alt,
    });
    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('PUT /api/posts error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}

export async function DELETE({ request }) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  const sessionid = url.searchParams.get('sessionid');

  if (!id) return new Response(JSON.stringify({ error: 'Post ID required' }), { status: 400 });
  if (!sessionid) return new Response('Session ID required', { status: 401 });

  const { user } = await lucia.validateSession(sessionid);
  if (!user || !['superadmin', 'admin', 'editor'].includes(user.role)) {
    return new Response('Unauthorized', { status: 403 });
  }

  try {
    await deleteContent(id);
    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('DELETE /api/posts error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
