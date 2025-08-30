/**
 * Utilities for converting between database posts and file-based CMS posts
 * Handles the mapping between different post identification schemes
 */

import slugify from 'slugify';

/**
 * Generate CMS file identifier from database post
 * @param {Object} dbPost - Database post object
 * @returns {string} CMS file identifier (e.g., "memorial/john-doe" or "articles/my-article")
 */
export function generateCmsId(dbPost) {
  let postType = 'articles';
  
  if (dbPost.category?.toLowerCase().includes('memorial')) {
    postType = 'memorial';
  } else if (dbPost.category?.toLowerCase().includes('news')) {
    postType = 'news';
  }

  const slug = slugify(dbPost.title, { 
    lower: true, 
    strict: true,
    remove: /[*+~.()'"!:@]/g 
  });

  return `${postType}/${slug}`;
}

/**
 * Generate markdown filename from database post
 * @param {Object} dbPost - Database post object
 * @returns {string} Markdown filename (e.g., "john-doe.md")
 */
export function generateMarkdownFilename(dbPost) {
  return slugify(dbPost.title, { 
    lower: true, 
    strict: true,
    remove: /[*+~.()'"!:@]/g 
  }) + '.md';
}

/**
 * Generate relative file path for CMS
 * @param {Object} dbPost - Database post object
 * @returns {string} Relative file path (e.g., "src/content/memorial/john-doe.md")
 */
export function generateCmsFilePath(dbPost) {
  let postType = 'articles';
  
  if (dbPost.category?.toLowerCase().includes('memorial')) {
    postType = 'memorial';
  } else if (dbPost.category?.toLowerCase().includes('news')) {
    postType = 'news';
  }

  const filename = generateMarkdownFilename(dbPost);
  return `src/content/${postType}/${filename}`;
}

/**
 * Generate URL slug from database post
 * @param {Object} dbPost - Database post object
 * @returns {string} URL slug (e.g., "/memorial/john-doe")
 */
export function generateUrlSlug(dbPost) {
  let postType = 'articles';
  
  if (dbPost.category?.toLowerCase().includes('memorial')) {
    postType = 'memorial';
  } else if (dbPost.category?.toLowerCase().includes('news')) {
    postType = 'news';
  }

  const slug = slugify(dbPost.title, { 
    lower: true, 
    strict: true,
    remove: /[*+~.()'"!:@]/g 
  });

  return `/${postType}/${slug}`;
}

/**
 * Extract post type from various sources
 * @param {Object} dbPost - Database post object
 * @returns {string} Post type (memorial, news, article)
 */
export function extractPostType(dbPost) {
  // Check category first
  if (dbPost.category?.toLowerCase().includes('memorial')) {
    return 'memorial';
  }
  if (dbPost.category?.toLowerCase().includes('news')) {
    return 'news';
  }
  
  // Check post type field if exists
  if (dbPost.type?.toLowerCase() === 'memorial') {
    return 'memorial';
  }
  if (dbPost.type?.toLowerCase() === 'news') {
    return 'news';
  }
  
  // Check title for clues
  if (dbPost.title?.toLowerCase().includes('memorial')) {
    return 'memorial';
  }
  
  // Default to article
  return 'article';
}

/**
 * Convert database timestamps to ISO format
 * @param {string|Date} timestamp - Database timestamp
 * @returns {string} ISO timestamp
 */
export function convertTimestamp(timestamp) {
  if (!timestamp) return new Date().toISOString();
  
  try {
    return new Date(timestamp).toISOString();
  } catch {
    return new Date().toISOString();
  }
}

/**
 * Split comma-separated fields into arrays
 * @param {string} field - Comma-separated string
 * @returns {Array} Array of trimmed strings
 */
export function splitCommaSeparated(field) {
  if (!field || typeof field !== 'string') return [];
  return field.split(',').map(item => item.trim()).filter(item => item.length > 0);
}

/**
 * Validate that a post has minimum required fields for CMS
 * @param {Object} dbPost - Database post object
 * @returns {Object} Validation result with errors array
 */
export function validateDbPost(dbPost) {
  const errors = [];
  
  if (!dbPost.title || dbPost.title.trim() === '') {
    errors.push('Title is required');
  }
  
  if (!dbPost.body && !dbPost.content) {
    errors.push('Content/body is required');
  }
  
  if (dbPost.title && dbPost.title.length > 100) {
    errors.push('Title is too long (max 100 characters)');
  }
  
  const content = dbPost.body || dbPost.content || '';
  if (content.length < 50) {
    errors.push('Content is too short (minimum 50 characters)');
  }
  
  return {
    valid: errors.length === 0,
    errors
  };
}