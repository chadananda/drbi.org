// Comment utilities using Content Layer API
import { getCollection } from 'astro:content';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { slugify } from './utils.js';

/**
 * Get all unmoderated comments from the content collection
 * @returns {Array} Array of unmoderated comment objects
 */
export async function getUnmoderatedComments_Content() {
  try {
    const comments = await getCollection('commentsLayer', (comment) => {
      return !comment.data.moderated;
    });
    
    return comments.map(comment => ({
      id: comment.data.id,
      postid: comment.data.postid,
      parentid: comment.data.parentid,
      name: comment.data.name,
      email: comment.data.email,
      date: comment.data.date,
      content: comment.data.content,
      starred: comment.data.starred,
      moderated: comment.data.moderated,
      website: comment.data.website,
      phone: comment.data.phone
    }));
  } catch (error) {
    console.error('Error fetching unmoderated comments:', error);
    return [];
  }
}

/**
 * Get all comments for a specific post
 * @param {string} postid - Post ID to filter by
 * @returns {Array} Array of comment objects for the post
 */
export async function getCommentsForPost_Content(postid) {
  try {
    const comments = await getCollection('commentsLayer', (comment) => {
      return comment.data.postid === postid;
    });
    
    return comments
      .map(comment => comment.data)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  } catch (error) {
    console.error(`Error fetching comments for post ${postid}:`, error);
    return [];
  }
}

/**
 * Get all comments from the content collection
 * @returns {Array} Array of all comment objects
 */
export async function getAllComments_Content() {
  try {
    const comments = await getCollection('commentsLayer');
    return comments
      .map(comment => comment.data)
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  } catch (error) {
    console.error('Error fetching all comments:', error);
    return [];
  }
}

/**
 * Save a comment to the file system as JSON
 * @param {Object} commentData - Comment data to save
 * @returns {boolean} Success status
 */
export async function saveComment_Content(commentData) {
  try {
    const commentsDir = './src/content/comments';
    mkdirSync(commentsDir, { recursive: true });
    
    const filename = `${commentData.id || Date.now()}.json`;
    const filepath = join(commentsDir, filename);
    
    // Ensure the comment has required fields
    const comment = {
      id: commentData.id || Date.now().toString(),
      postid: commentData.postid,
      parentid: commentData.parentid || null,
      name: commentData.name,
      email: commentData.email || '',
      date: commentData.date || new Date().toISOString(),
      content: commentData.content,
      starred: commentData.starred || false,
      moderated: commentData.moderated || false,
      website: commentData.website || '',
      phone: commentData.phone || ''
    };
    
    writeFileSync(filepath, JSON.stringify(comment, null, 2));
    console.log(`✅ Comment saved: ${filename}`);
    return true;
  } catch (error) {
    console.error('Error saving comment:', error);
    return false;
  }
}

/**
 * Update a comment's moderation status
 * @param {string} commentId - Comment ID to update
 * @param {boolean} moderated - New moderation status
 * @param {boolean} starred - New starred status (optional)
 * @returns {boolean} Success status
 */
export async function updateCommentModeration_Content(commentId, moderated, starred = null) {
  try {
    const comments = await getCollection('commentsLayer');
    const comment = comments.find(c => c.data.id === commentId);
    
    if (!comment) {
      console.error(`Comment ${commentId} not found`);
      return false;
    }
    
    // Update the comment data
    const updatedComment = {
      ...comment.data,
      moderated,
      ...(starred !== null && { starred })
    };
    
    // Save back to file system
    const commentsDir = './src/content/comments';
    const filename = `${commentId}.json`;
    const filepath = join(commentsDir, filename);
    
    writeFileSync(filepath, JSON.stringify(updatedComment, null, 2));
    console.log(`✅ Comment ${commentId} updated: moderated=${moderated}${starred !== null ? `, starred=${starred}` : ''}`);
    return true;
  } catch (error) {
    console.error(`Error updating comment ${commentId}:`, error);
    return false;
  }
}

/**
 * Batch update multiple comments' moderation status
 * @param {Array} commentIds - Array of comment IDs to update
 * @param {boolean} moderated - New moderation status
 * @param {boolean} starred - New starred status (optional)
 * @returns {boolean} Success status
 */
export async function updateCommentsModeration_Content(commentIds, moderated, starred = null) {
  if (!commentIds || commentIds.length === 0) return true;
  
  const results = await Promise.all(
    commentIds.map(id => updateCommentModeration_Content(id, moderated, starred))
  );
  
  return results.every(result => result === true);
}

/**
 * Delete a comment from the file system
 * @param {string} commentId - Comment ID to delete
 * @returns {boolean} Success status
 */
export async function deleteComment_Content(commentId) {
  try {
    const fs = await import('fs');
    const filepath = `./src/content/comments/${commentId}.json`;
    
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
      console.log(`✅ Comment ${commentId} deleted`);
      return true;
    } else {
      console.warn(`Comment file ${commentId}.json not found`);
      return false;
    }
  } catch (error) {
    console.error(`Error deleting comment ${commentId}:`, error);
    return false;
  }
}