// Public comment submission — OpenAI moderation → Turso
export const prerender = false;

import { sanitizeInput, moderateCommentWithOpenAI } from '@utils/utils.js';
import { createComment, getApprovedComments } from '@lib/queries';

export const GET = async ({ request }) => {
  const url = new URL(request.url);
  const postId = url.searchParams.get('postId') ?? url.searchParams.get('postid');
  if (!postId) return new Response(JSON.stringify({ error: 'postId required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  const comments = await getApprovedComments(postId);
  return new Response(JSON.stringify(comments), { status: 200, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } });
};

export const POST = async ({ request }) => {
  if (request.headers.get('Content-Type') !== 'application/json') {
    return new Response(JSON.stringify({ success: false, error: 'Invalid request format' }), { status: 400 });
  }

  try {
    let { postid, parentid, name, content, website, phone } = await request.json();

    name = sanitizeInput(name, 40);
    content = sanitizeInput(content, 2000);

    if (!name || !content || website || phone || content.includes('http')) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid submission' }), { status: 400 });
    }

    let postDescription = '';
    try {
      const { getPostFromSlug } = await import('@utils/content-utils.js');
      const post = await getPostFromSlug(postid);
      postDescription = post?.data?.description || post?.data?.title || '';
    } catch {}

    const moderationResult = await moderateCommentWithOpenAI({ name, content, postid, parentid }, postDescription);

    if (!moderationResult.approved) {
      return new Response(JSON.stringify({ success: false, rejected: true, reason: moderationResult.reason, confidence: moderationResult.confidence }), { status: 200 });
    }

    const id = Math.random().toString(36).substr(2, 12);
    await createComment({ id, post_id: postid, parent_id: parentid || undefined, name, content, approved: true, ai_score: moderationResult.confidence });

    return new Response(JSON.stringify({ success: true, comment: { id, postid, name, content, date: new Date().toISOString() }, moderation: { approved: true, confidence: moderationResult.confidence } }), { status: 200 });
  } catch (error) {
    console.error('Comment submission error:', error);
    return new Response(JSON.stringify({ success: false, error: 'Server error' }), { status: 500 });
  }
};
