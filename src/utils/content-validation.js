/**
 * Content Validation System
 * 
 * Validates content before committing to prevent broken builds
 */

import matter from 'gray-matter';
import MarkdownIt from 'markdown-it';
import fs from 'fs/promises';
import path from 'path';
import { exec as execCallback } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const exec = promisify(execCallback);

// Initialize markdown parser
const md = new MarkdownIt();

/**
 * Custom validation error class
 */
export class ValidationError extends Error {
  constructor(errors) {
    super(`Validation failed: ${errors.join(', ')}`);
    this.name = 'ValidationError';
    this.errors = errors;
  }
}

/**
 * Validate post frontmatter
 * @param {Object} frontmatter - Parsed frontmatter object
 * @param {string} postType - Post type (memorial, news, article)
 * @returns {Array} Array of validation errors
 */
function validateFrontmatter(frontmatter, postType) {
  const errors = [];

  // Required fields for all posts
  if (!frontmatter.title || frontmatter.title.trim() === '') {
    errors.push('Title is required');
  }

  if (!frontmatter.language) {
    errors.push('Language is required');
  }

  if (!frontmatter.datePublished) {
    errors.push('Publication date is required');
  } else {
    // Validate date format
    const date = new Date(frontmatter.datePublished);
    if (isNaN(date.getTime())) {
      errors.push('Invalid publication date format');
    }
  }

  if (!frontmatter.url || frontmatter.url.trim() === '') {
    errors.push('URL slug is required');
  } else {
    // Validate URL format
    if (!frontmatter.url.startsWith('/')) {
      errors.push('URL must start with /');
    }
    
    if (!/^\/[a-z0-9\/\-]+$/.test(frontmatter.url)) {
      errors.push('URL contains invalid characters (use lowercase letters, numbers, hyphens, and slashes only)');
    }
  }

  // Type-specific validations
  switch (postType.toLowerCase()) {
    case 'memorial':
      if (!frontmatter.description) {
        errors.push('Memorial posts require a description');
      }
      break;

    case 'news':
      if (!frontmatter.abstract) {
        errors.push('News posts require an abstract');
      }
      break;

    case 'article':
      if (!frontmatter.description && !frontmatter.abstract) {
        errors.push('Articles require either a description or abstract');
      }
      break;
  }

  // Validate arrays
  if (frontmatter.topics && !Array.isArray(frontmatter.topics)) {
    errors.push('Topics must be an array');
  }

  if (frontmatter.keywords && !Array.isArray(frontmatter.keywords)) {
    errors.push('Keywords must be an array');
  }

  // Validate image object if present
  if (frontmatter.image && typeof frontmatter.image === 'object') {
    if (!frontmatter.image.src) {
      errors.push('Image must have a src property');
    }
    if (!frontmatter.image.alt) {
      errors.push('Image must have an alt property for accessibility');
    }
  }

  // Check title length (SEO best practice)
  if (frontmatter.title && frontmatter.title.length > 60) {
    errors.push('Title should be 60 characters or less for SEO');
  }

  // Check description length if present
  if (frontmatter.description && frontmatter.description.length > 160) {
    errors.push('Description should be 160 characters or less for SEO');
  }

  return errors;
}

/**
 * Validate markdown content
 * @param {string} content - Markdown content
 * @returns {Array} Array of validation errors
 */
function validateMarkdown(content) {
  const errors = [];

  if (!content || content.trim() === '') {
    errors.push('Content cannot be empty');
    return errors;
  }

  try {
    // Try to parse markdown
    md.render(content);
  } catch (error) {
    errors.push(`Invalid markdown syntax: ${error.message}`);
    return errors;
  }

  // Check for common markdown issues
  const lines = content.split('\n');
  
  lines.forEach((line, index) => {
    const lineNum = index + 1;
    
    // Check for malformed links
    const linkMatches = line.match(/\[([^\]]*)\]\(([^)]*)\)/g);
    if (linkMatches) {
      linkMatches.forEach(link => {
        const urlMatch = link.match(/\[([^\]]*)\]\(([^)]*)\)/);
        if (urlMatch) {
          const [, text, url] = urlMatch;
          if (!text.trim()) {
            errors.push(`Line ${lineNum}: Link text cannot be empty`);
          }
          if (!url.trim()) {
            errors.push(`Line ${lineNum}: Link URL cannot be empty`);
          }
        }
      });
    }

    // Check for malformed images
    const imageMatches = line.match(/!\[([^\]]*)\]\(([^)]*)\)/g);
    if (imageMatches) {
      imageMatches.forEach(image => {
        const urlMatch = image.match(/!\[([^\]]*)\]\(([^)]*)\)/);
        if (urlMatch) {
          const [, alt, url] = urlMatch;
          if (!alt.trim()) {
            errors.push(`Line ${lineNum}: Image alt text is required for accessibility`);
          }
          if (!url.trim()) {
            errors.push(`Line ${lineNum}: Image URL cannot be empty`);
          }
        }
      });
    }
  });

  // Check content length
  if (content.length < 100) {
    errors.push('Content seems too short (less than 100 characters)');
  }

  return errors;
}

/**
 * Validate internal links
 * @param {string} content - Markdown content
 * @returns {Promise<Array>} Array of validation errors
 */
async function validateInternalLinks(content) {
  const errors = [];
  const projectRoot = path.resolve(__dirname, '../..');

  // Find internal links (starting with /)
  const linkRegex = /\[([^\]]*)\]\((\/.+?)\)/g;
  const matches = Array.from(content.matchAll(linkRegex));

  for (const match of matches) {
    const [, text, url] = match;
    
    // Skip external-looking URLs
    if (url.startsWith('http') || url.includes('://')) {
      continue;
    }

    // Check if it's a page that should exist
    const possiblePaths = [
      path.join(projectRoot, 'src/pages', url + '.astro'),
      path.join(projectRoot, 'src/pages', url + '.md'),
      path.join(projectRoot, 'src/pages', url + '.mdx'),
      path.join(projectRoot, 'src/pages', url, 'index.astro'),
      path.join(projectRoot, 'src/pages', url, 'index.md'),
      path.join(projectRoot, 'src/content/memorial', url.replace(/^\/memorial\//, '') + '.md'),
      path.join(projectRoot, 'src/content/news', url.replace(/^\/news\//, '') + '.md'),
      path.join(projectRoot, 'src/content/articles', url.replace(/^\/articles\//, '') + '.md'),
      path.join(projectRoot, 'public', url)
    ];

    let found = false;
    for (const possiblePath of possiblePaths) {
      try {
        await fs.access(possiblePath);
        found = true;
        break;
      } catch {
        // File doesn't exist, continue checking
      }
    }

    if (!found) {
      errors.push(`Broken internal link: ${url} (referenced as "${text}")`);
    }
  }

  return errors;
}

/**
 * Validate image references
 * @param {string} content - Markdown content
 * @param {Object} frontmatter - Frontmatter object
 * @returns {Promise<Array>} Array of validation errors
 */
async function validateImageReferences(content, frontmatter) {
  const errors = [];
  const projectRoot = path.resolve(__dirname, '../..');

  // Check frontmatter image
  if (frontmatter.image && typeof frontmatter.image === 'object' && frontmatter.image.src) {
    const imageSrc = frontmatter.image.src;
    
    // Skip external images and S3 URLs
    if (!imageSrc.startsWith('http') && !imageSrc.includes('amazonaws.com') && imageSrc.startsWith('/')) {
      const imagePath = path.join(projectRoot, 'public', imageSrc);
      try {
        await fs.access(imagePath);
      } catch {
        errors.push(`Frontmatter image not found: ${imageSrc}`);
      }
    }
  }

  // Check markdown image references
  const imageRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
  const matches = Array.from(content.matchAll(imageRegex));

  for (const match of matches) {
    const [, alt, src] = match;
    
    // Skip external images and S3 URLs
    if (src.startsWith('http') || src.includes('amazonaws.com')) {
      continue;
    }

    // Check local images
    if (src.startsWith('/')) {
      const imagePath = path.join(projectRoot, 'public', src);
      try {
        await fs.access(imagePath);
      } catch {
        errors.push(`Image not found: ${src}`);
      }
    } else if (src.startsWith('./') || src.startsWith('../')) {
      // Relative path - more complex to validate, skip for now
      // Could be enhanced to resolve relative paths
    }
  }

  return errors;
}

/**
 * Run build check on content
 * @param {string} filePath - Relative path where file would be saved
 * @param {string} fileContent - Complete file content
 * @returns {Promise<Array>} Array of validation errors
 */
async function validateBuildCheck(filePath, fileContent) {
  if (!process.env.CMS_BUILD_CHECK || process.env.VERCEL) {
    // Skip build check in production or if disabled
    return [];
  }

  const errors = [];
  const projectRoot = path.resolve(__dirname, '../..');
  const testFileName = `.test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}.md`;
  const testFilePath = path.join(projectRoot, testFileName);

  try {
    // Write test file
    await fs.writeFile(testFilePath, fileContent);

    // Run quick syntax check (could be expanded to run actual build)
    try {
      await exec(`cd ${projectRoot} && npx astro check --config astro.config.mjs`, {
        timeout: 30000 // 30 second timeout
      });
    } catch (checkError) {
      if (checkError.stderr && checkError.stderr.includes(testFileName)) {
        errors.push(`Build check failed: ${checkError.stderr}`);
      }
      // If error doesn't mention our test file, it might be unrelated
    }
  } catch (error) {
    errors.push(`Build check error: ${error.message}`);
  } finally {
    // Clean up test file
    try {
      await fs.unlink(testFilePath);
    } catch {
      // Ignore cleanup errors
    }
  }

  return errors;
}

/**
 * Main validation function
 * @param {Object} postData - Post data object
 * @param {string} postData.title - Post title
 * @param {string} postData.content - Markdown content
 * @param {string} postData.type - Post type (memorial, news, article)
 * @param {Object} postData.frontmatter - Additional frontmatter
 * @param {string} fileContent - Complete file content with frontmatter
 * @param {string} filePath - File path where content would be saved
 * @returns {Promise<void>} Throws ValidationError if validation fails
 */
export async function validateContent(postData, fileContent, filePath = '') {
  const allErrors = [];

  try {
    // Parse the complete file content
    const parsed = matter(fileContent);
    
    // 1. Validate frontmatter
    const frontmatterErrors = validateFrontmatter(parsed.data, postData.type || 'article');
    allErrors.push(...frontmatterErrors);

    // 2. Validate markdown content
    const markdownErrors = validateMarkdown(parsed.content);
    allErrors.push(...markdownErrors);

    // 3. Validate internal links (async)
    if (process.env.CMS_VALIDATE_STRICT !== 'false') {
      const linkErrors = await validateInternalLinks(parsed.content);
      allErrors.push(...linkErrors);

      // 4. Validate image references (async)
      const imageErrors = await validateImageReferences(parsed.content, parsed.data);
      allErrors.push(...imageErrors);
    }

    // 5. Run build check (async, only in development)
    if (process.env.CMS_BUILD_CHECK === 'true') {
      const buildErrors = await validateBuildCheck(filePath, fileContent);
      allErrors.push(...buildErrors);
    }

    // Throw validation error if any issues found
    if (allErrors.length > 0) {
      throw new ValidationError(allErrors);
    }

  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    
    // Handle parsing errors
    allErrors.push(`Content parsing error: ${error.message}`);
    throw new ValidationError(allErrors);
  }
}

/**
 * Quick validation for real-time feedback
 * @param {Object} postData - Post data object
 * @returns {Array} Array of validation errors (non-async checks only)
 */
export function quickValidate(postData) {
  const errors = [];

  // Basic required field checks
  if (!postData.title || postData.title.trim() === '') {
    errors.push('Title is required');
  }

  if (!postData.content || postData.content.trim() === '') {
    errors.push('Content is required');
  }

  if (postData.title && postData.title.length > 60) {
    errors.push('Title should be 60 characters or less');
  }

  try {
    if (postData.content) {
      md.render(postData.content);
    }
  } catch (error) {
    errors.push(`Invalid markdown: ${error.message}`);
  }

  return errors;
}