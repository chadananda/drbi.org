// CMS editor save endpoint. Saves body+data to Turso content table.
export const prerender = false;

import { lucia } from "../../lib/auth";
import { getContentById, updateContent, createContent } from "../../lib/queries";
import { isGitHubConfigured } from '../../utils/github-cms.js';
import { createPost, updatePostById } from '../../utils/cms-utils.js';
import { generateCmsId, generateUrlSlug, extractPostType, convertTimestamp, splitCommaSeparated, validateDbPost } from '../../utils/post-conversion.js';

// GET - fetch post by id for editor
export const GET = async ({ request }) => {
  const url = new URL(request.url);
  const id = atob(url.searchParams.get('id') ?? '');
  if (!id) return new Response('Post ID required', { status: 400 });

  const post = await getContentById(id);
  if (!post) return new Response(JSON.stringify({ error: 'Not found' }), { status: 404, headers: { 'Content-Type': 'application/json' } });

  return new Response(JSON.stringify(post), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

// POST - save body and/or data to Turso, optionally commit to GitHub
export const POST = async ({ request }) => {
  const sessionid = request.headers.get('Authorization')?.replace('Bearer ', '').trim();
  const { id, body, data, githubCommit = false } = await request.json();

  if (!id || (!data && !body)) return new Response('ID and data or body required', { status: 400 });
  if (!sessionid) return new Response('User session required', { status: 400 });

  const { user } = await lucia.validateSession(sessionid);
  if (!user || !['superadmin', 'admin', 'editor', 'author'].includes(user.role)) {
    return new Response('User authentication failed', { status: 403 });
  }

  let result = { post: null, github: null, dbSaved: false, githubCommitted: false };

  // Save to Turso
  try {
    const existing = await getContentById(id);
    const updates = {
      ...(body !== undefined && { body }),
      ...(data?.title && { title: data.title }),
      ...(data?.description && { description: data.description }),
      ...(data?.desc_125 && { desc_125: data.desc_125 }),
      ...(data?.abstract && { abstract: data.abstract }),
      ...(data?.author && { author: data.author }),
      ...(data?.category && { category: data.category }),
      ...(data?.topics && { topics: data.topics }),
      ...(data?.keywords && { keywords: data.keywords }),
      ...(data?.datePublished && { date_published: data.datePublished }),
      ...(data?.image?.src && { image_src: data.image.src, image_alt: data.image.alt ?? '' }),
      ...(data?.audio && { audio: data.audio }),
      ...(data?.narrator && { narrator: data.narrator }),
      draft: data?.draft ? 1 : 0,
      date_modified: new Date().toISOString(),
    };

    if (existing) {
      await updateContent(id, updates);
    } else {
      // Create new record if it doesn't exist yet
      const parts = id.split('/'); // e.g. articles/my-slug/en
      await createContent({
        id,
        slug: parts[1] ?? id,
        collection: parts[0] ?? 'articles',
        language: parts[2] ?? 'en',
        title: data?.title ?? '',
        body: body ?? '',
        ...updates,
      });
    }

    result.post = await getContentById(id);
    result.dbSaved = true;
  } catch (e) {
    console.error('Error saving to Turso:', e);
    return new Response('Database save failed', { status: 500 });
  }

  // GitHub commit (optional)
  if (githubCommit && isGitHubConfigured() && result.post) {
    try {
      const postType = extractPostType(result.post.data ?? {});
      const frontmatter = {
        description: result.post.data?.description ?? '',
        topics: result.post.data?.topics ?? [],
        keywords: result.post.data?.keywords ?? [],
        author: result.post.data?.author ?? user.id,
        category: result.post.data?.category ?? '',
        post_type: postType,
        datePublished: result.post.data?.datePublished ?? null,
        draft: result.post.data?.draft ?? false,
      };
      if (result.post.data?.image_src) {
        frontmatter.image = { src: result.post.data.image_src, alt: result.post.data.image_alt ?? '' };
      }

      const postData = {
        title: result.post.data?.title ?? '',
        content: result.post.body ?? '',
        type: postType,
        frontmatter,
        author: user.id,
        email: user.email ?? 'cms@drbi.org',
        cmsId: id,
        isNewPost: !result.post.data?.datePublished,
      };

      if (postData.isNewPost) {
        result.github = await createPost(postData);
      } else {
        result.github = await updatePostById(postData.cmsId, postData);
      }
      result.githubCommitted = true;
    } catch (githubError) {
      console.error('GitHub commit failed:', githubError);
      result.github = { error: githubError.message };
    }
  }

  return new Response(JSON.stringify({
    success: true,
    ...result,
    message: result.githubCommitted
      ? 'Post saved to Turso and committed to GitHub'
      : 'Post saved to Turso',
  }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

export const DELETE = async ({ request }) => {
  const sessionid = request.headers.get('Authorization')?.replace('Bearer ', '').trim();
  const url = new URL(request.url);
  const postId = url.searchParams.get('id');

  if (!postId) return new Response('Post ID required', { status: 400 });
  if (!sessionid) return new Response('User session required', { status: 400 });

  const { user } = await lucia.validateSession(sessionid);
  if (!user || !['superadmin', 'admin', 'editor'].includes(user.role)) {
    return new Response('Unauthorized', { status: 403 });
  }

  try {
    const { deleteContent } = await import('../../lib/queries');
    await deleteContent(postId);
    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Delete failed:', error);
    return new Response('Delete failed', { status: 500 });
  }
};
