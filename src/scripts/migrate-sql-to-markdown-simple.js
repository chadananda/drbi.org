#!/usr/bin/env node
/**
 * Simple SQL dump parser for Astro 5.0 Content Layer migration
 * 
 * This script directly parses the SQL dump file using regex 
 * and creates markdown files without requiring SQLite dependencies
 */

import fs from 'fs/promises';
import path from 'path';
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
 * Parse SQL INSERT statements using regex
 */
function parseInsertStatements(sqlContent, tableName) {
  const insertRegex = new RegExp(`INSERT INTO ${tableName} VALUES\\((.+?)\\);`, 'g');
  const records = [];
  let match;

  while ((match = insertRegex.exec(sqlContent)) !== null) {
    try {
      // This is a simplified parser - it won't handle all edge cases
      // but should work for our specific SQL dump format
      const values = match[1];
      const record = parseValues(values);
      records.push(record);
    } catch (error) {
      log.warn(`Failed to parse ${tableName} record:`, error.message);
    }
  }

  return records;
}

/**
 * Parse comma-separated values with proper quote handling and function calls
 */
function parseValues(valueString) {
  const values = [];
  let current = '';
  let inQuotes = false;
  let escapeNext = false;
  let parenDepth = 0;
  
  for (let i = 0; i < valueString.length; i++) {
    const char = valueString[i];
    
    if (escapeNext) {
      current += char;
      escapeNext = false;
      continue;
    }
    
    if (char === '\\') {
      escapeNext = true;
      current += char;
      continue;
    }
    
    if (char === "'" && !inQuotes && parenDepth === 0) {
      inQuotes = true;
      continue;
    }
    
    if (char === "'" && inQuotes && parenDepth === 0) {
      inQuotes = false;
      continue;
    }
    
    if (char === '(' && !inQuotes) {
      parenDepth++;
    }
    
    if (char === ')' && !inQuotes) {
      parenDepth--;
    }
    
    if (char === ',' && !inQuotes && parenDepth === 0) {
      values.push(processValue(current.trim()));
      current = '';
      continue;
    }
    
    current += char;
  }
  
  if (current.trim()) {
    values.push(processValue(current.trim()));
  }
  
  return values;
}

/**
 * Process individual value (handle NULL, replace, etc.)
 */
function processValue(value) {
  if (value === 'NULL') return null;
  
  // Handle replace() function calls
  if (value.startsWith('replace(')) {
    // Handle nested replace functions: replace(replace('content','\r',char(13)),'\n',char(10))
    const nestedMatch = value.match(/replace\(replace\('(.*?)',.*?\),.*?\)/s);
    if (nestedMatch) {
      let content = nestedMatch[1];
      // Apply common replacements
      content = content.replace(/\\r\\n/g, '\n')
                       .replace(/\\n/g, '\n')
                       .replace(/\\r/g, '\n')
                       .replace(/\\\\/g, '\\')
                       .replace(/\\'/g, "'");
      return content;
    }
    
    // Handle simple replace: replace('content','\n',char(10))
    const simpleMatch = value.match(/replace\('(.*?)',.*?\)/s);
    if (simpleMatch) {
      let content = simpleMatch[1];
      content = content.replace(/\\n/g, '\n')
                       .replace(/\\r/g, '\n')
                       .replace(/\\\\/g, '\\')
                       .replace(/\\'/g, "'");
      return content;
    }
    
    // If regex fails, try to extract manually
    if (value.includes("'")) {
      const firstQuote = value.indexOf("'");
      const lastQuote = value.lastIndexOf("'");
      if (firstQuote !== -1 && lastQuote > firstQuote) {
        let content = value.substring(firstQuote + 1, lastQuote);
        content = content.replace(/\\n/g, '\n')
                         .replace(/\\r/g, '\n')
                         .replace(/\\\\/g, '\\')
                         .replace(/\\'/g, "'");
        return content;
      }
    }
  }
  
  return value;
}

/**
 * Convert Posts table records to proper objects
 */
function convertPostsToObjects(records) {
  const posts = [];
  
  // Posts table structure from db/tables.ts:
  const columns = [
    'id', 'baseid', 'title', 'url', 'post_type', 'description', 'desc_125', 
    'abstract', 'language', 'audio', 'audio_duration', 'audio_image', 
    'narrator', 'draft', 'author', 'editor', 'category', 'topics', 
    'keywords', 'datePublished', 'dateModified', 'image', 'body'
  ];

  for (const record of records) {
    const post = {};
    for (let i = 0; i < columns.length && i < record.length; i++) {
      post[columns[i]] = record[i];
    }
    posts.push(post);
  }

  return posts;
}

/**
 * Convert other tables to objects
 */
function convertGenericToObjects(records, tableName) {
  const objects = [];
  let columns = [];
  
  // Define column structures for each table
  switch (tableName) {
    case 'Categories':
      columns = ['id', 'category', 'image', 'description'];
      break;
    case 'Topics':
      columns = ['id', 'name', 'title', 'description', 'image', 'faqs'];
      break;
    case 'Team':
      columns = ['id', 'name', 'title', 'image_src', 'image_alt', 'external', 'email', 'isFictitious', 'jobTitle', 'type', 'url', 'worksFor_type', 'worksFor_name', 'description', 'sameAs_linkedin', 'sameAs_twitter', 'sameAs_facebook', 'description_125', 'description_250', 'biography'];
      break;
    case 'Comments':
      columns = ['id', 'postid', 'parentid', 'name', 'content', 'moderated', 'date', 'starred'];
      break;
    default:
      return records;
  }

  for (const record of records) {
    const obj = {};
    for (let i = 0; i < columns.length && i < record.length; i++) {
      obj[columns[i]] = record[i];
    }
    objects.push(obj);
  }

  return objects;
}

/**
 * Load and parse SQL dump file
 */
async function loadSqlData(sqlFilePath) {
  const sqlContent = await fs.readFile(sqlFilePath, 'utf8');
  const data = {};

  // Parse each table
  const tables = ['Posts', 'Categories', 'Topics', 'Team', 'Comments'];
  
  for (const table of tables) {
    log.info(`Parsing ${table} table...`);
    const records = parseInsertStatements(sqlContent, table);
    
    if (table === 'Posts') {
      data[table] = convertPostsToObjects(records);
    } else {
      data[table] = convertGenericToObjects(records, table);
    }
    
    log.success(`Parsed ${data[table].length} ${table} records`);
  }

  return data;
}

/**
 * Convert post to frontmatter format
 */
function postToFrontmatter(post) {
  // Parse JSON fields safely
  let topics = [];
  let keywords = [];
  
  try {
    topics = post.topics && post.topics !== '[]' ? JSON.parse(post.topics) : [];
  } catch (e) {
    log.warn(`Failed to parse topics for ${post.id}: ${post.topics}`);
  }
  
  try {
    keywords = post.keywords && post.keywords !== '[]' ? JSON.parse(post.keywords) : [];
  } catch (e) {
    log.warn(`Failed to parse keywords for ${post.id}: ${post.keywords}`);
  }

  const frontmatter = {
    title: post.title || '',
    description: post.description || '',
    desc_125: post.desc_125 || post.description?.substring(0, 125) || '',
    abstract: post.abstract || '',
    
    // Post metadata
    post_type: post.post_type || 'Article',
    url: post.url || slugify(post.title || ''),
    language: post.language || 'en',
    draft: Boolean(Number(post.draft)),
    
    // Content metadata  
    author: post.author || '',
    editor: post.editor || '',
    category: post.category || '',
    topics: topics,
    keywords: keywords,
    
    // Dates (convert to ISO strings)
    datePublished: post.datePublished || new Date().toISOString(),
    dateModified: post.dateModified || new Date().toISOString(),
    
    // Media
    image: post.image ? {
      src: post.image,
      alt: post.description || post.title || ''
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
  const yamlLines = [];
  
  for (const [key, value] of Object.entries(frontmatter)) {
    if (value === '' || value === null || value === undefined) continue;
    
    if (typeof value === 'string') {
      // Escape quotes and handle multiline strings
      const escaped = value.replace(/"/g, '\\"').replace(/\n/g, '\\n');
      yamlLines.push(`${key}: "${escaped}"`);
    } else if (Array.isArray(value)) {
      if (value.length === 0) {
        yamlLines.push(`${key}: []`);
      } else {
        yamlLines.push(`${key}:`);
        value.forEach(item => yamlLines.push(`  - "${item}"`));
      }
    } else if (typeof value === 'object' && value !== null) {
      if (key === 'image') {
        yamlLines.push(`${key}:`);
        yamlLines.push(`  src: "${value.src}"`);
        yamlLines.push(`  alt: "${value.alt}"`);
      } else {
        yamlLines.push(`${key}: ${JSON.stringify(value)}`);
      }
    } else {
      yamlLines.push(`${key}: ${value}`);
    }
  }

  const content = `---
${yamlLines.join('\n')}
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
    try {
      const collection = getCollectionName(post.post_type);
      const filename = `${post.url || slugify(post.title || 'untitled')}.md`;
      const filepath = path.join(contentDir, collection, filename);
      
      const markdownContent = generateMarkdownContent(post);
      
      await fs.writeFile(filepath, markdownContent, 'utf8');
      createdFiles++;
      stats[collection]++;
      log.success(`Created: ${collection}/${filename}`);
    } catch (error) {
      log.error(`Failed to create file for post ${post.id}:`, error.message);
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
  if (data.Categories && data.Categories.length > 0) {
    const categoriesPath = path.join(dataDir, 'categories.json');
    await fs.writeFile(categoriesPath, JSON.stringify(data.Categories, null, 2));
    log.success(`Created: categories.json (${data.Categories.length} entries)`);
  }

  // Topics
  if (data.Topics && data.Topics.length > 0) {
    const topicsPath = path.join(dataDir, 'topics.json');
    await fs.writeFile(topicsPath, JSON.stringify(data.Topics, null, 2));
    log.success(`Created: topics.json (${data.Topics.length} entries)`);
  }

  // Team
  if (data.Team && data.Team.length > 0) {
    const teamPath = path.join(dataDir, 'team.json');
    await fs.writeFile(teamPath, JSON.stringify(data.Team, null, 2));
    log.success(`Created: team.json (${data.Team.length} entries)`);
  }

  // Comments - organize by post
  if (data.Comments && data.Comments.length > 0) {
    const commentsDir = path.join(dataDir, 'comments');
    await fs.mkdir(commentsDir, { recursive: true });
    
    const commentsByPost = {};
    data.Comments.forEach(comment => {
      const postid = comment.postid;
      if (!commentsByPost[postid]) {
        commentsByPost[postid] = [];
      }
      commentsByPost[postid].push(comment);
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
    
    log.info('Starting simple SQL to Markdown migration...');
    log.info(`Reading SQL dump: ${sqlFile}`);

    // Load SQL data
    const data = await loadSqlData(sqlFile);
    log.success(`Successfully parsed SQL dump`);

    // Create markdown files
    if (data.Posts && data.Posts.length > 0) {
      await createMarkdownFiles(data.Posts);
    } else {
      log.warn('No posts found in SQL dump');
    }

    // Create auxiliary JSON files
    await createAuxiliaryFiles(data);

    log.success('Migration completed successfully!');
    log.info('Next steps:');
    log.info('1. Review generated markdown files');
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