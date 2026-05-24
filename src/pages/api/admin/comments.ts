// Admin comment management — star, approve, delete
export const prerender = false;

import { lucia } from '../../../lib/auth';
import { getComments, updateComment, deleteComment, getCommentStats } from '../../../lib/queries';

async function requireAdmin(request: Request) {
  const sessionid = request.headers.get('Authorization')?.replace('Bearer ', '').trim() ?? '';
  if (!sessionid) return null;
  const { user } = await lucia.validateSession(sessionid);
  if (!user || !['superadmin', 'admin', 'editor'].includes(user.role)) return null;
  return user;
}

export const GET: import('astro').APIRoute = async ({ request, locals }) => {
  const user = locals?.user;
  if (!user || !['superadmin', 'admin', 'editor'].includes(user.role)) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 403 });
  }
  const url = new URL(request.url);
  const postId = url.searchParams.get('postId') ?? undefined;
  const [comments, stats] = await Promise.all([getComments(postId), getCommentStats()]);
  return new Response(JSON.stringify({ comments, stats }), { status: 200, headers: { 'Content-Type': 'application/json' } });
};

export const POST: import('astro').APIRoute = async ({ request }) => {
  const sessionid = request.headers.get('Authorization')?.replace('Bearer ', '').trim() ?? '';
  const user = sessionid ? (await lucia.validateSession(sessionid)).user : null;
  if (!user || !['superadmin', 'admin', 'editor'].includes(user.role)) {
    return new Response('Unauthorized', { status: 403 });
  }

  const { action, commentId, ...data } = await request.json();

  try {
    switch (action) {
      case 'star':
        await updateComment(commentId, { starred: data.starred });
        break;
      case 'approve':
        await updateComment(commentId, { approved: data.approved });
        break;
      case 'delete':
        await deleteComment(commentId);
        break;
      default:
        return new Response(JSON.stringify({ error: 'Unknown action' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }
    return new Response(JSON.stringify({ success: true }), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
};
