// src/pages/api/post_db.js
export const prerender = false;

import {  savePost_DB, getTeamMemberBySlug, slugify, getPost_DB } from '@utils/utils.js';
import { lucia } from "../../lib/auth";

// // fetch post by id -- doesn't work in dev with Vite
export const GET = async ({ request }) => {
  const url = new URL(request.url);
  const postid = atob(url.searchParams.get('id'));
  // console.log('GET id:', postid);
  if (!postid) return new Response('Post ID required', { status: 400 });
  const post = await getPost_DB(postid);
  return new Response(JSON.stringify(post), {status: 200, headers: {'Content-Type': 'application/json'} });
};

// we post in either a body or data object or both
export const POST = async ({ request }) => {
  // console.log('POST to /api/post_db');
  const sessionid = request.headers.get('Authorization').replace('Bearer ', '').trim();
  let {id, body, data} = await request.json();
  // validate minimum required fields
  if (!id || (!data && !body)) return new Response('ID and data or body required', { status: 400 });
  if (!sessionid) return new Response('User session required', { status: 400 });
  // verify session and role & is team member
  const { user } = await lucia.validateSession(sessionid);
  if (!user || !['superadmin', 'admin', 'editor', 'author'].includes(user.role)) {
    return new Response('User authentication failed', { status: 403 });
  }
  if (!(await getTeamMemberBySlug(user.id))) return new Response('Team member not found', { status: 404 });

  // save body and data to db
  try {
    await savePost_DB(id, data, body);
    let post = await getPost_DB(id); // load changes
    return new Response(JSON.stringify(post), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    console.error('Error updating post:', e);
    return new Response('Update failed', { status: 400 });
  }
};




export const DELETE = async ({ request }) => {
  // const user = await checkUser(request);
  // if (!user.authenticated) return new Response('Unauthorized', { status: 401 });
  // const url = new URL(request?.url);
  // const slug = url.searchParams.get('slug');
  // if (!slug) return new Response('Article slug required', { status: 400 });
  // await deletePendingPost('article', slug);
  // return new Response('Article deleted', { status: 200 });
};



