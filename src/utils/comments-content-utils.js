// Comment utilities - DISABLED (Database removed)
// All functions return empty/success results since comments are database-dependent
import { slugify } from './utils.js';

/**
 * Get all unmoderated comments - DISABLED
 * @returns {Array} Empty array (comments disabled)
 */
export async function getUnmoderatedComments_Content() {
  console.log('getUnmoderatedComments_Content called but comments disabled, returning empty array');
  return [];
}

/**
 * Get comments for a specific post - DISABLED
 * @param {string} postid - Post ID to filter by
 * @returns {Array} Empty array (comments disabled)
 */
export async function getCommentsForPost_Content(postid) {
  console.log('getCommentsForPost_Content called but comments disabled, returning empty array');
  return [];
}

/**
 * Get all comments - DISABLED
 * @returns {Array} Empty array (comments disabled)
 */
export async function getAllComments_Content() {
  console.log('getAllComments_Content called but comments disabled, returning empty array');
  return [];
}

/**
 * Save a comment - DISABLED
 * @param {Object} commentData - Comment data to save
 * @returns {Object} Success response (comments disabled)
 */
export async function saveComment_Content(commentData) {
  console.log('saveComment_Content called but comments disabled, returning success');
  return { success: true, message: 'Comments disabled - database removed' };
}

/**
 * Update comment moderation status - DISABLED
 * @param {string} commentId - Comment ID to update
 * @param {boolean} moderated - Moderation status
 * @param {boolean} starred - Starred status
 * @returns {Object} Success response (comments disabled)
 */
export async function updateCommentModeration_Content(commentId, moderated, starred = null) {
  console.log('updateCommentModeration_Content called but comments disabled, returning success');
  return { success: true, message: 'Comments disabled - database removed' };
}

/**
 * Update multiple comments moderation status - DISABLED
 * @param {Array} commentIds - Array of comment IDs to update
 * @param {boolean} moderated - Moderation status
 * @param {boolean} starred - Starred status
 * @returns {Object} Success response (comments disabled)
 */
export async function updateCommentsModeration_Content(commentIds, moderated, starred = null) {
  console.log('updateCommentsModeration_Content called but comments disabled, returning success');
  return { success: true, message: 'Comments disabled - database removed' };
}

/**
 * Delete a comment - DISABLED
 * @param {string} commentId - Comment ID to delete
 * @returns {Object} Success response (comments disabled)
 */
export async function deleteComment_Content(commentId) {
  console.log('deleteComment_Content called but comments disabled, returning success');
  return { success: true, message: 'Comments disabled - database removed' };
}