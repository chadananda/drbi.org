/**
 * File-based CMS Utilities for Astro 5.0
 * 
 * These utilities provide CRUD operations for managing markdown content files
 * to replace the previous Astro DB functionality
 */

import fs from 'fs/promises';
import path from 'path';
import matter from 'gray-matter';
import slugify from 'slugify';
import { fileURLToPath } from 'url';
import { commitToGitHub, deleteFromGitHub, isGitHubConfigured } from './github-cms.js';
import { validateContent } from './content-validation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Content directories
const CONTENT_BASE_DIR = path.join(__dirname, '../../src/content');
const COLLECTIONS = {
  memorial: 'memorial',
  news: 'news', 
  article: 'articles'
};

// =============================================
// FILE OPERATIONS
// =============================================

/**
 * Ensure directory exists
 * @param {string} dirPath - Directory path
 */
async function ensureDir(dirPath) {
  try {
    await fs.access(dirPath);
  } catch {
    await fs.mkdir(dirPath, { recursive: true });
  }
}

/**
 * Generate unique filename for a post
 * @param {string} title - Post title
 * @param {string} type - Post type (memorial, news, article)
 * @param {string} language - Language code
 * @returns {string} Unique filename
 */
function generateFilename(title, type, language = 'en') {
  const slug = slugify(title, { lower: true, strict: true });
  const timestamp = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  
  if (language === 'en') {
    return `${slug}.md`;
  } else {
    return `${slug}/${language}.md`;
  }
}

/**
 * Get collection directory path
 * @param {string} type - Post type
 * @returns {string} Collection directory path
 */
function getCollectionDir(type) {
  const collection = COLLECTIONS[type.toLowerCase()] || 'articles';
  return path.join(CONTENT_BASE_DIR, collection);
}

// =============================================
// CONTENT CREATION
// =============================================

/**
 * Create new markdown post
 * @param {Object} postData - Post data
 * @param {string} postData.title - Post title
 * @param {string} postData.content - Post content (markdown)
 * @param {string} postData.type - Post type (memorial, news, article)
 * @param {string} postData.language - Language code
 * @param {Object} postData.frontmatter - Additional frontmatter data
 * @param {string} postData.author - Author name for commit
 * @param {string} postData.email - Author email for commit
 * @returns {Promise<Object>} Result with file path and commit info
 */
export async function createPost(postData) {
  const {
    title,
    content,
    type = 'article',
    language = 'en',
    frontmatter = {},
    author = 'DRBI CMS',
    email = 'cms@drbi.org'
  } = postData;

  if (!title || !content) {
    throw new Error('Title and content are required');
  }

  const collectionDir = getCollectionDir(type);
  const filename = generateFilename(title, type, language);
  const filePath = path.join(collectionDir, filename);
  const relativeFilePath = path.relative(path.resolve(__dirname, '../..'), filePath);

  // Check if file already exists locally
  try {
    await fs.access(filePath);
    throw new Error(`Post already exists: ${filename}`);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }

  // Generate URL slug
  const urlSlug = `/${type}/${slugify(title, { lower: true, strict: true })}`;

  // Prepare frontmatter
  const postFrontmatter = {
    title,
    language,
    url: urlSlug,
    datePublished: new Date().toISOString(),
    dateModified: new Date().toISOString(),
    draft: false,
    ...frontmatter
  };

  // Create markdown file with frontmatter
  const fileContent = matter.stringify(content, postFrontmatter);
  
  // VALIDATE content before any operations
  await validateContent(postData, fileContent, relativeFilePath);

  // Determine where to save based on environment and token availability
  const useGitHub = isGitHubConfigured() && (process.env.VERCEL || process.env.CMS_USE_GITHUB === 'true');

  let result = {
    filePath: relativeFilePath,
    method: useGitHub ? 'github' : 'local',
    title,
    url: urlSlug
  };

  if (useGitHub) {
    try {
      // Commit directly to GitHub
      const commitSha = await commitToGitHub(
        relativeFilePath,
        fileContent,
        `Add ${type}: ${title}`,
        author,
        email
      );
      
      result.commitSha = commitSha;
      result.commitUrl = `https://github.com/chadananda/drbi.org/commit/${commitSha}`;
      
      console.log(`✅ Post committed to GitHub: ${title}`);
    } catch (error) {
      console.error('GitHub commit failed, falling back to local:', error);
      
      // Fallback to local file system
      await ensureDir(path.dirname(filePath));
      await fs.writeFile(filePath, fileContent, 'utf8');
      result.method = 'local_fallback';
      result.error = error.message;
    }
  } else {
    // Save locally (development or no GitHub token)
    await ensureDir(path.dirname(filePath));
    await fs.writeFile(filePath, fileContent, 'utf8');
    console.log(`📁 Post saved locally: ${title}`);
  }

  return result;
}

// =============================================
// CONTENT EDITING
// =============================================

/**
 * Update existing markdown post
 * @param {string} filePath - Path to markdown file
 * @param {Object} updates - Updates to apply
 * @param {string} updates.title - New title
 * @param {string} updates.content - New content
 * @param {Object} updates.frontmatter - Frontmatter updates
 * @param {string} updates.author - Author name for commit
 * @param {string} updates.email - Author email for commit
 * @returns {Promise<Object>} Result with success status and commit info
 */
export async function updatePost(filePath, updates) {
  const {
    title,
    content,
    frontmatter,
    author = 'DRBI CMS',
    email = 'cms@drbi.org'
  } = updates;

  try {
    // Read existing file (try GitHub first, then local)
    let fileContent;
    let parsed;
    
    const useGitHub = isGitHubConfigured() && (process.env.VERCEL || process.env.CMS_USE_GITHUB === 'true');
    const relativeFilePath = path.isAbsolute(filePath) 
      ? path.relative(path.resolve(__dirname, '../..'), filePath)
      : filePath;

    if (useGitHub) {
      // In GitHub mode, we need to read from the actual file for local fallback
      try {
        fileContent = await fs.readFile(filePath, 'utf8');
      } catch {
        throw new Error(`File not found locally: ${filePath}`);
      }
    } else {
      // Local mode
      fileContent = await fs.readFile(filePath, 'utf8');
    }

    parsed = matter(fileContent);

    // Apply updates
    if (content !== undefined) {
      parsed.content = content;
    }

    if (title !== undefined) {
      parsed.data.title = title;
    }

    if (frontmatter) {
      parsed.data = { ...parsed.data, ...frontmatter };
    }

    // Update modification date
    parsed.data.dateModified = new Date().toISOString();

    // Create updated content
    const updatedContent = matter.stringify(parsed.content, parsed.data);
    
    // VALIDATE updated content
    const postData = {
      title: parsed.data.title,
      content: parsed.content,
      type: relativeFilePath.split('/')[2], // Extract from path: src/content/TYPE/
      frontmatter: parsed.data
    };
    await validateContent(postData, updatedContent, relativeFilePath);

    let result = {
      success: true,
      filePath: relativeFilePath,
      method: useGitHub ? 'github' : 'local',
      title: parsed.data.title
    };

    if (useGitHub) {
      try {
        // Commit to GitHub
        const commitSha = await commitToGitHub(
          relativeFilePath,
          updatedContent,
          `Update ${postData.type}: ${parsed.data.title}`,
          author,
          email
        );
        
        result.commitSha = commitSha;
        result.commitUrl = `https://github.com/chadananda/drbi.org/commit/${commitSha}`;
        
        console.log(`✅ Post updated on GitHub: ${parsed.data.title}`);
      } catch (error) {
        console.error('GitHub update failed, falling back to local:', error);
        
        // Fallback to local update
        await fs.writeFile(filePath, updatedContent, 'utf8');
        result.method = 'local_fallback';
        result.error = error.message;
      }
    } else {
      // Update locally
      await fs.writeFile(filePath, updatedContent, 'utf8');
      console.log(`📁 Post updated locally: ${parsed.data.title}`);
    }

    return result;
  } catch (error) {
    console.error('Error updating post:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Update post by ID/slug
 * @param {string} identifier - Post ID or slug
 * @param {Object} updates - Updates to apply
 * @returns {Promise<boolean>} Success status
 */
export async function updatePostById(identifier, updates) {
  const filePath = await findPostFile(identifier);
  if (!filePath) {
    throw new Error(`Post not found: ${identifier}`);
  }
  return await updatePost(filePath, updates);
}

// =============================================
// CONTENT DELETION
// =============================================

/**
 * Delete markdown post
 * @param {string} filePath - Path to markdown file
 * @param {string} author - Author name for commit
 * @param {string} email - Author email for commit
 * @returns {Promise<Object>} Result with success status and commit info
 */
export async function deletePost(filePath, author = 'DRBI CMS', email = 'cms@drbi.org') {
  try {
    const useGitHub = isGitHubConfigured() && (process.env.VERCEL || process.env.CMS_USE_GITHUB === 'true');
    const relativeFilePath = path.isAbsolute(filePath) 
      ? path.relative(path.resolve(__dirname, '../..'), filePath)
      : filePath;

    // Get post title for commit message
    let postTitle = 'Unknown Post';
    try {
      const fileContent = await fs.readFile(filePath, 'utf8');
      const parsed = matter(fileContent);
      postTitle = parsed.data.title || postTitle;
    } catch {
      // Can't read file, use default title
    }

    let result = {
      success: true,
      filePath: relativeFilePath,
      method: useGitHub ? 'github' : 'local',
      title: postTitle
    };

    if (useGitHub) {
      try {
        // Delete from GitHub
        const commitSha = await deleteFromGitHub(
          relativeFilePath,
          `Delete post: ${postTitle}`
        );
        
        result.commitSha = commitSha;
        result.commitUrl = `https://github.com/chadananda/drbi.org/commit/${commitSha}`;
        
        console.log(`✅ Post deleted from GitHub: ${postTitle}`);
      } catch (error) {
        console.error('GitHub deletion failed, falling back to local:', error);
        
        // Fallback to local deletion
        await fs.unlink(filePath);
        await cleanupEmptyDirectories(filePath);
        result.method = 'local_fallback';
        result.error = error.message;
      }
    } else {
      // Delete locally
      await fs.unlink(filePath);
      await cleanupEmptyDirectories(filePath);
      console.log(`📁 Post deleted locally: ${postTitle}`);
    }

    return result;
  } catch (error) {
    console.error('Error deleting post:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Clean up empty directories after file deletion
 * @param {string} filePath - Path to the deleted file
 */
async function cleanupEmptyDirectories(filePath) {
  const fileDir = path.dirname(filePath);
  const contentDir = path.resolve(__dirname, '../../src/content');
  
  // Don't try to delete directories above content directory
  if (!fileDir.startsWith(contentDir)) {
    return;
  }
  
  try {
    const remainingFiles = await fs.readdir(fileDir);
    if (remainingFiles.length === 0 && fileDir !== contentDir) {
      await fs.rmdir(fileDir);
      console.log(`🧹 Cleaned up empty directory: ${fileDir}`);
    }
  } catch {
    // Directory not empty or doesn't exist, ignore
  }
}

/**
 * Delete post by ID/slug
 * @param {string} identifier - Post ID or slug
 * @returns {Promise<boolean>} Success status
 */
export async function deletePostById(identifier) {
  const filePath = await findPostFile(identifier);
  if (!filePath) {
    throw new Error(`Post not found: ${identifier}`);
  }
  return await deletePost(filePath);
}

// =============================================
// FILE DISCOVERY
// =============================================

/**
 * Find post file by ID or slug
 * @param {string} identifier - Post ID or URL slug
 * @returns {Promise<string|null>} File path or null if not found
 */
export async function findPostFile(identifier) {
  const collections = Object.values(COLLECTIONS);
  
  for (const collection of collections) {
    const collectionDir = path.join(CONTENT_BASE_DIR, collection);
    
    try {
      const files = await getAllMarkdownFiles(collectionDir);
      
      for (const filePath of files) {
        const fileContent = await fs.readFile(filePath, 'utf8');
        const parsed = matter(fileContent);
        
        // Check if this file matches the identifier
        const filename = path.basename(filePath, '.md');
        const fileId = path.relative(collectionDir, filePath).replace(/\.md$/, '');
        
        if (fileId === identifier || 
            parsed.data.url === identifier || 
            parsed.data.url === `/${identifier}` ||
            filename === identifier) {
          return filePath;
        }
      }
    } catch (error) {
      console.warn(`Error searching in ${collection}:`, error);
    }
  }
  
  return null;
}

/**
 * Get all markdown files in directory recursively
 * @param {string} dir - Directory to search
 * @returns {Promise<Array>} Array of file paths
 */
async function getAllMarkdownFiles(dir) {
  const files = [];
  
  try {
    const items = await fs.readdir(dir, { withFileTypes: true });
    
    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      
      if (item.isDirectory()) {
        const subFiles = await getAllMarkdownFiles(fullPath);
        files.push(...subFiles);
      } else if (item.isFile() && item.name.endsWith('.md')) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    console.warn(`Directory not accessible: ${dir}`);
  }
  
  return files;
}

// =============================================
// CONTENT READING
// =============================================

/**
 * Read post data by file path
 * @param {string} filePath - Path to markdown file
 * @returns {Promise<Object>} Post data with frontmatter and content
 */
export async function readPost(filePath) {
  try {
    const fileContent = await fs.readFile(filePath, 'utf8');
    const parsed = matter(fileContent);
    
    return {
      filePath,
      frontmatter: parsed.data,
      content: parsed.content,
      id: path.relative(CONTENT_BASE_DIR, filePath).replace(/\.md$/, ''),
    };
  } catch (error) {
    console.error('Error reading post:', error);
    return null;
  }
}

/**
 * Read post by ID or slug
 * @param {string} identifier - Post ID or slug
 * @returns {Promise<Object|null>} Post data or null if not found
 */
export async function readPostById(identifier) {
  const filePath = await findPostFile(identifier);
  if (!filePath) {
    return null;
  }
  return await readPost(filePath);
}

// =============================================
// BATCH OPERATIONS
// =============================================

/**
 * Get all posts from a collection
 * @param {string} type - Post type (memorial, news, article)
 * @returns {Promise<Array>} Array of post data
 */
export async function getAllPostsByType(type) {
  const collectionDir = getCollectionDir(type);
  const files = await getAllMarkdownFiles(collectionDir);
  
  const posts = [];
  for (const filePath of files) {
    const postData = await readPost(filePath);
    if (postData) {
      posts.push(postData);
    }
  }
  
  return posts.sort((a, b) => 
    new Date(b.frontmatter.datePublished) - new Date(a.frontmatter.datePublished)
  );
}

/**
 * Search posts by title or content
 * @param {string} query - Search query
 * @param {string} type - Optional post type filter
 * @returns {Promise<Array>} Matching posts
 */
export async function searchPosts(query, type = null) {
  const collections = type ? [COLLECTIONS[type.toLowerCase()]] : Object.values(COLLECTIONS);
  const results = [];
  
  for (const collection of collections) {
    if (!collection) continue;
    
    const collectionDir = path.join(CONTENT_BASE_DIR, collection);
    const files = await getAllMarkdownFiles(collectionDir);
    
    for (const filePath of files) {
      const postData = await readPost(filePath);
      if (postData) {
        const searchText = `${postData.frontmatter.title} ${postData.content}`.toLowerCase();
        if (searchText.includes(query.toLowerCase())) {
          results.push(postData);
        }
      }
    }
  }
  
  return results.sort((a, b) => 
    new Date(b.frontmatter.datePublished) - new Date(a.frontmatter.datePublished)
  );
}

// =============================================
// MEDIA MANAGEMENT
// =============================================

/**
 * Copy media file to public directory
 * @param {string} sourcePath - Source file path
 * @param {string} destinationPath - Destination path relative to public/
 * @returns {Promise<string>} Public URL path
 */
export async function addMediaFile(sourcePath, destinationPath) {
  const publicDir = path.join(__dirname, '../../public');
  const fullDestPath = path.join(publicDir, destinationPath);
  
  // Ensure destination directory exists
  await ensureDir(path.dirname(fullDestPath));
  
  // Copy file
  await fs.copyFile(sourcePath, fullDestPath);
  
  // Return public URL
  return `/${destinationPath}`;
}

/**
 * Remove media file from public directory
 * @param {string} publicPath - Path relative to public/
 * @returns {Promise<boolean>} Success status
 */
export async function removeMediaFile(publicPath) {
  try {
    const publicDir = path.join(__dirname, '../../public');
    const fullPath = path.join(publicDir, publicPath);
    await fs.unlink(fullPath);
    return true;
  } catch (error) {
    console.error('Error removing media file:', error);
    return false;
  }
}