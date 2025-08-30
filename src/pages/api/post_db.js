// src/pages/api/post_db.js
export const prerender = false;

import {  savePost_DB, getTeamMemberBySlug, slugify, getPost_DB } from '@utils/utils.js';
import { lucia } from "../../lib/auth";
import { createPost, updatePostById, deletePostById } from '../../utils/cms-utils.js';
import { isGitHubConfigured } from '../../utils/github-cms.js';
import { 
  generateCmsId, 
  generateUrlSlug, 
  extractPostType, 
  convertTimestamp, 
  splitCommaSeparated, 
  validateDbPost 
} from '../../utils/post-conversion.js';

/**
 * Convert database post format to CMS markdown format
 * @param {Object} dbPost - Post from database
 * @param {Object} teamMember - Team member info
 * @returns {Object} CMS-formatted post data
 */
function convertDbPostToCmsFormat(dbPost, teamMember) {
  // Validate the post first
  const validation = validateDbPost(dbPost);
  if (!validation.valid) {
    throw new Error(`Invalid post data: ${validation.errors.join(', ')}`);
  }

  const postType = extractPostType(dbPost);

  // Extract frontmatter from database post
  const frontmatter = {
    description: dbPost.abstract || dbPost.description || `Article about ${dbPost.title}`,
    topics: splitCommaSeparated(dbPost.topics),
    keywords: splitCommaSeparated(dbPost.keywords),
    author: dbPost.author || teamMember.name,
    category: dbPost.category,
    post_type: postType.charAt(0).toUpperCase() + postType.slice(1),
    dateCreated: convertTimestamp(dbPost.dateCreated),
    lastModified: convertTimestamp(dbPost.lastModified),
    draft: dbPost.draft === true || dbPost.status === 'draft'
  };

  // Add image if present
  if (dbPost.image) {
    if (typeof dbPost.image === 'string') {
      frontmatter.image = {
        src: dbPost.image,
        alt: dbPost.imageAlt || `Image for ${dbPost.title}`
      };
    } else if (typeof dbPost.image === 'object') {
      frontmatter.image = dbPost.image;
    }
  }

  // Add SEO fields if available
  if (dbPost.desc_125) {
    frontmatter.desc_125 = dbPost.desc_125;
  }

  // Determine if this is a new post (heuristic: if it was created recently)
  const createdDate = new Date(dbPost.dateCreated || dbPost.lastModified || Date.now());
  const isNewPost = (Date.now() - createdDate.getTime()) < (24 * 60 * 60 * 1000); // Less than 24 hours old

  return {
    title: dbPost.title,
    content: dbPost.body || dbPost.content || '',
    type: postType,
    language: dbPost.language || 'en',
    frontmatter,
    author: teamMember.name || 'DRBI CMS',
    email: teamMember.email || 'cms@drbi.org',
    isNewPost,
    cmsId: generateCmsId(dbPost),
    urlSlug: generateUrlSlug(dbPost)
  };
}

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
  let {id, body, data, githubCommit = false} = await request.json();
  
  // validate minimum required fields
  if (!id || (!data && !body)) return new Response('ID and data or body required', { status: 400 });
  if (!sessionid) return new Response('User session required', { status: 400 });
  
  // verify session and role & is team member
  const { user } = await lucia.validateSession(sessionid);
  if (!user || !['superadmin', 'admin', 'editor', 'author'].includes(user.role)) {
    return new Response('User authentication failed', { status: 403 });
  }
  
  const teamMember = await getTeamMemberBySlug(user.id);
  if (!teamMember) return new Response('Team member not found', { status: 404 });

  let result = {
    post: null,
    github: null,
    dbSaved: false,
    githubCommitted: false
  };

  // save body and data to db (existing functionality)
  try {
    await savePost_DB(id, data, body);
    let post = await getPost_DB(id); // load changes
    result.post = post;
    result.dbSaved = true;
    console.log('✅ Post saved to database:', id);
  } catch (e) {
    console.error('Error saving to database:', e);
    return new Response('Database save failed', { status: 400 });
  }

  // GitHub commit (new functionality) - only if explicitly requested and GitHub available
  if (githubCommit && isGitHubConfigured()) {
    try {
      // Convert database post to CMS format
      const postData = convertDbPostToCmsFormat(result.post, teamMember);
      
      // Use the CMS ID for operations
      let githubResult;
      if (postData.isNewPost) {
        githubResult = await createPost(postData);
        console.log('✅ New post created on GitHub:', postData.cmsId);
      } else {
        githubResult = await updatePostById(postData.cmsId, {
          title: postData.title,
          content: postData.content,
          frontmatter: postData.frontmatter,
          author: postData.author,
          email: postData.email
        });
        console.log('✅ Post updated on GitHub:', postData.cmsId);
      }
      
      result.github = githubResult;
      result.githubCommitted = true;
      
    } catch (githubError) {
      console.error('GitHub commit failed:', githubError);
      // Don't fail the entire request - GitHub commit is optional
      result.github = { error: githubError.message };
    }
  }

  return new Response(JSON.stringify({
    success: true,
    ...result,
    message: result.githubCommitted 
      ? 'Post saved to database and committed to GitHub' 
      : 'Post saved to database (GitHub commit skipped)'
  }), {
    status: 200, 
    headers: { 'Content-Type': 'application/json' }
  });
};




export const DELETE = async ({ request }) => {
  const sessionid = request.headers.get('Authorization')?.replace('Bearer ', '').trim();
  const url = new URL(request.url);
  const postId = url.searchParams.get('id');
  const githubDelete = url.searchParams.get('github') === 'true';

  // Validate required fields
  if (!postId) return new Response('Post ID required', { status: 400 });
  if (!sessionid) return new Response('User session required', { status: 400 });

  // Verify session and permissions
  const { user } = await lucia.validateSession(sessionid);
  if (!user || !['superadmin', 'admin', 'editor'].includes(user.role)) {
    return new Response('User authentication failed', { status: 403 });
  }

  const teamMember = await getTeamMemberBySlug(user.id);
  if (!teamMember) return new Response('Team member not found', { status: 404 });

  let result = {
    dbDeleted: false,
    githubDeleted: false,
    github: null
  };

  try {
    // Get post info before deletion for GitHub
    let postInfo = null;
    if (githubDelete && isGitHubConfigured()) {
      try {
        postInfo = await getPost_DB(postId);
      } catch (e) {
        console.warn('Could not retrieve post info for GitHub deletion:', e);
      }
    }

    // Delete from database (existing functionality)
    // Note: You'll need to implement deletePost_DB in your utils
    // await deletePost_DB(postId);
    // result.dbDeleted = true;
    
    // For now, return error since deletePost_DB doesn't exist yet
    return new Response('Database deletion not implemented yet', { status: 501 });

    // GitHub deletion (if requested and available)
    if (githubDelete && isGitHubConfigured() && postInfo) {
      try {
        const postData = convertDbPostToCmsFormat(postInfo, teamMember);
        
        const githubResult = await deletePostById(postData.cmsId);
        result.github = githubResult;
        result.githubDeleted = githubResult.success;
        
        if (result.githubDeleted) {
          console.log('✅ Post deleted from GitHub:', postData.cmsId);
        }
      } catch (githubError) {
        console.error('GitHub deletion failed:', githubError);
        result.github = { error: githubError.message };
      }
    }

    return new Response(JSON.stringify({
      success: true,
      ...result,
      message: result.githubDeleted 
        ? 'Post deleted from database and GitHub' 
        : 'Post deleted from database (GitHub deletion skipped)'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Delete operation failed:', error);
    return new Response('Delete operation failed', { status: 500 });
  }
};



