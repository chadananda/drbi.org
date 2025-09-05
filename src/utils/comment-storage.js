/**
 * Comment Storage Utilities
 * Handles loading and managing comments from JSON files
 */

import { promises as fs } from 'fs';
import path from 'path';

const COMMENTS_DIR = path.join(process.cwd(), 'src/content/comments');

export async function getAllComments() {
  try {
    // For now return empty array since comments directory doesn't exist yet
    return [];
  } catch (error) {
    console.error('Error loading comments:', error);
    return [];
  }
}

export async function getCommentStats() {
  const comments = await getAllComments();
  
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  return {
    total: comments.length,
    starred: comments.filter(c => c.starred).length,
    recent: comments.filter(c => new Date(c.date) > sevenDaysAgo).length
  };
}