// Content posts API — read from Turso, write via cms-utils (filesystem + Turso sync)
export const prerender = false;

import { lucia } from "../../lib/auth";
import {
  getAllContent,
  getContentByCollection,
  getContentBySlug,
  getContentById,
  createContent,
  updateContent,
  deleteContent,
} from "../../lib/queries";

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

async function requireAuth(request) {
  const body = await request.json();
  const { sessionid } = body;
  if (!sessionid) return { error: 'Session ID required', status: 401 };
  const { user } = await lucia.validateSession(sessionid);
  if (!user || !['superadmin', 'admin', 'editor', 'author'].includes(user.role)) {
    return { error: 'Unauthorized', status: 403 };
  }
  return { user, body };
}

export async function POST({ request }) {
  const auth = await requireAuth(request.clone());
  if (auth.error) return new Response(auth.error, { status: auth.status });

  const { action, sessionid, ...data } = auth.body;

  try {
    switch (action) {
      case 'create': {
        if (!data.title || !data.content) {
          return new Response(JSON.stringify({ error: 'Title and content required' }), {
            status: 400, headers: { 'Content-Type': 'application/json' }
          });
        }
        const result = await createContent({
          slug: data.slug ?? data.title.toLowerCase().replace(/\s+/g, '-'),
          collection: data.type ?? 'articles',
          title: data.title,
          body: data.content,
          description: data.frontmatter?.description ?? '',
          draft: data.frontmatter?.draft ? 1 : 0,
          author: data.frontmatter?.author ?? null,
          topics: data.frontmatter?.topics ?? [],
          keywords: data.frontmatter?.keywords ?? [],
          date_published: data.frontmatter?.datePublished ?? null,
          image_src: data.frontmatter?.image?.src ?? null,
          image_alt: data.frontmatter?.image?.alt ?? null,
        });
        return new Response(JSON.stringify({ success: true, id: result.id }), {
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

export async function PUT({ request }) {
  const url = new URL(request.url);
  const id = url.searchParams.get('id');
  if (!id) {
    return new Response(JSON.stringify({ error: 'Post ID required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' }
    });
  }

  const auth = await requireAuth(request.clone());
  if (auth.error) return new Response(auth.error, { status: auth.status });

  const { sessionid, ...data } = auth.body;

  try {
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
      image_src: data.frontmatter?.image?.src,
      image_alt: data.frontmatter?.image?.alt,
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
