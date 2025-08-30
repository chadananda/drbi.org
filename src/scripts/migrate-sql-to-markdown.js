#!/usr/bin/env node
/**
 * Migrate SQL dump to Markdown files for Astro 5.0 Content Layer
 * 
 * This script extracts posts from the SQL dump and creates markdown files
 * organized by content type (memorial, news, articles)
 */

import fs from 'fs/promises';
import path from 'path';
import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import slugify from 'slugify';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../..');

// Logging utilities
const log = {
  info: (msg, data = '') => console.log('ℹ️ ', msg, data),
  success: (msg, data = '') => console.log('✅', msg, data),
  warn: (msg, data = '') => console.warn('⚠️ ', msg, data),
  error: (msg, data = '') => console.error('❌', msg, data)
};

/**
 * Load and parse SQL dump file
 */
async function loadSqlData(sqlFilePath) {
  const db = new Database(':memory:');
  
  try {
    // Read and execute SQL dump
    const sqlContent = await fs.readFile(sqlFilePath, 'utf8');
    db.exec(sqlContent);

    // Extract all data from tables
    const data = {};
    const tables = ['Posts', 'Categories', 'Topics', 'Team', 'Comments'];
    
    for (const table of tables) {
      try {
        const rows = db.prepare(`SELECT * FROM ${table}`).all();
        data[table] = rows;
      } catch (error) {
        log.warn(`Table ${table} not found or empty`);
        data[table] = [];
      }
    }

    return data;
  } finally {
    db.close();
  }
}

/**
 * Convert post to frontmatter format
 */
function postToFrontmatter(post) {
  // Parse JSON fields
  const topics = post.topics ? JSON.parse(post.topics) : [];
  const keywords = post.keywords ? JSON.parse(post.keywords) : [];

  const frontmatter = {
    title: post.title,
    description: post.description,
    desc_125: post.desc_125 || post.description.substring(0, 125),
    abstract: post.abstract || '',
    
    // Post metadata
    post_type: post.post_type,
    url: post.url,
    language: post.language || 'en',
    draft: Boolean(post.draft),
    
    // Content metadata  
    author: post.author || '',
    editor: post.editor || '',
    category: post.category || '',
    topics: topics,
    keywords: keywords,
    
    // Dates (convert to ISO strings)
    datePublished: new Date(post.datePublished).toISOString(),
    dateModified: new Date(post.dateModified).toISOString(),
    
    // Media
    image: post.image ? {
      src: post.image,
      alt: post.description
    } : null,
    
    // Audio (if present)
    audio: post.audio || '',
    audio_duration: post.audio_duration || '',
    audio_image: post.audio_image || '',
    narrator: post.narrator || 'auto'
  };

  return frontmatter;
}

/**
 * Generate markdown file content
 */
function generateMarkdownContent(post) {
  const frontmatter = postToFrontmatter(post);
  
  // Convert frontmatter to YAML
  const yaml = Object.entries(frontmatter)
    .filter(([key, value]) => value !== '' && value !== null && value !== undefined)
    .map(([key, value]) => {
      if (typeof value === 'string') {
        // Escape quotes and handle multiline strings
        const escaped = value.replace(/"/g, '\\"');
        return `${key}: "${escaped}"`;
      } else if (Array.isArray(value)) {
        if (value.length === 0) return `${key}: []`;
        return `${key}:\n${value.map(item => `  - "${item}"`).join('\n')}`;
      } else if (typeof value === 'object' && value !== null) {
        if (key === 'image') {
          return `${key}:\n  src: "${value.src}"\n  alt: "${value.alt}"`;
        }
        return `${key}: ${JSON.stringify(value)}`;
      } else {
        return `${key}: ${value}`;
      }
    })
    .join('\n');

  const content = `---
${yaml}
---

${post.body || ''}
`;

  return content;
}

/**
 * Get collection name based on post type
 */
function getCollectionName(postType) {
  switch (postType?.toLowerCase()) {
    case 'memorial':
      return 'memorial';
    case 'news':
      return 'news'; 
    case 'article':
    default:
      return 'articles';
  }
}

/**
 * Create directory structure and write markdown files
 */
async function createMarkdownFiles(posts) {
  const contentDir = path.join(projectRoot, 'src/content');
  
  // Create content directories
  const collections = new Set(['memorial', 'news', 'articles']);
  for (const collection of collections) {
    const dir = path.join(contentDir, collection);
    await fs.mkdir(dir, { recursive: true });
    log.info(`Created directory: ${collection}/`);
  }

  let createdFiles = 0;
  const stats = { memorial: 0, news: 0, articles: 0 };

  for (const post of posts) {
    const collection = getCollectionName(post.post_type);
    const filename = `${post.url || slugify(post.title)}.md`;
    const filepath = path.join(contentDir, collection, filename);
    
    const markdownContent = generateMarkdownContent(post);
    
    try {
      await fs.writeFile(filepath, markdownContent, 'utf8');
      createdFiles++;
      stats[collection]++;
      log.success(`Created: ${collection}/${filename}`);
    } catch (error) {
      log.error(`Failed to create ${collection}/${filename}:`, error.message);
    }
  }

  log.info('Migration statistics:', stats);
  log.success(`Total files created: ${createdFiles}`);
}

/**
 * Create auxiliary JSON files for categories, topics, and team
 */
async function createAuxiliaryFiles(data) {
  const dataDir = path.join(projectRoot, 'src/data');
  await fs.mkdir(dataDir, { recursive: true });

  // Categories
  if (data.Categories) {
    const categoriesPath = path.join(dataDir, 'categories.json');
    await fs.writeFile(categoriesPath, JSON.stringify(data.Categories, null, 2));
    log.success(`Created: categories.json (${data.Categories.length} entries)`);
  }

  // Topics
  if (data.Topics) {
    const topicsPath = path.join(dataDir, 'topics.json');
    await fs.writeFile(topicsPath, JSON.stringify(data.Topics, null, 2));
    log.success(`Created: topics.json (${data.Topics.length} entries)`);
  }

  // Team
  if (data.Team) {
    const teamPath = path.join(dataDir, 'team.json');
    await fs.writeFile(teamPath, JSON.stringify(data.Team, null, 2));
    log.success(`Created: team.json (${data.Team.length} entries)`);
  }

  // Comments - organize by post
  if (data.Comments) {
    const commentsDir = path.join(dataDir, 'comments');
    await fs.mkdir(commentsDir, { recursive: true });
    
    const commentsByPost = {};
    data.Comments.forEach(comment => {
      if (!commentsByPost[comment.postid]) {
        commentsByPost[comment.postid] = [];
      }
      commentsByPost[comment.postid].push(comment);
    });

    let commentsCreated = 0;
    for (const [postid, comments] of Object.entries(commentsByPost)) {
      const commentsPath = path.join(commentsDir, `${postid}.json`);
      await fs.writeFile(commentsPath, JSON.stringify(comments, null, 2));
      commentsCreated++;
    }
    
    log.success(`Created: ${commentsCreated} comment files (${data.Comments.length} total comments)`);
  }
}

/**
 * Main migration function
 */
async function main() {
  try {
    const sqlFile = path.join(projectRoot, 'db/db-export-1736903622-drbi.sql');
    
    log.info('Starting SQL to Markdown migration...');
    log.info(`Reading SQL dump: ${sqlFile}`);

    // Load SQL data
    const data = await loadSqlData(sqlFile);
    log.success(`Loaded data from SQL dump`);
    log.info(`Found ${data.Posts?.length || 0} posts`);
    log.info(`Found ${data.Categories?.length || 0} categories`);
    log.info(`Found ${data.Topics?.length || 0} topics`);
    log.info(`Found ${data.Team?.length || 0} team members`);
    log.info(`Found ${data.Comments?.length || 0} comments`);

    // Create markdown files
    if (data.Posts && data.Posts.length > 0) {
      await createMarkdownFiles(data.Posts);
    }

    // Create auxiliary JSON files
    await createAuxiliaryFiles(data);

    log.success('Migration completed successfully!');
    log.info('Next steps:');
    log.info('1. Run the script again if you need to re-import');
    log.info('2. Set up content collections configuration');
    log.info('3. Update utility functions to use Content Layer API');

  } catch (error) {
    log.error('Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { main as migrateToMarkdown };