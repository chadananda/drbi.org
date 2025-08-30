/**
 * Content Layer Utilities for Astro 5.0
 * 
 * These utilities replace the database-based functions with file-based content collection queries
 */

import { getCollection, getEntry } from 'astro:content';
import slugify from 'slugify';
import { getArticleHelpers } from './utils.js';

// =============================================
// MAIN POST QUERY FUNCTIONS
// =============================================

/**
 * Get published posts by type using the new content collections
 * @param {string} type - Post type: 'Memorial', 'News', 'Article'
 * @param {string} lang - Language code (default: 'en')
 * @returns {Array} Array of posts with helpers
 */
export const getPublishedPostsByType_Content = async (type, lang = 'en') => {
  let collectionName;
  
  // Map post types to collection names
  switch (type.toLowerCase()) {
    case 'memorial':
      collectionName = 'memorial';
      break;
    case 'news':
      collectionName = 'news';
      break;
    case 'article':
    default:
      collectionName = 'articles';
      break;
  }
  
  try {
    const posts = await getCollection(collectionName, (post) => {
      return post.data.language === lang && 
             !post.data.draft && 
             post.data.datePublished <= new Date();
    });
    
    return posts
      .sort((a, b) => b.data.datePublished.getTime() - a.data.datePublished.getTime())
      .map(post => ({ ...post, helpers: getArticleHelpers(post) }));
  } catch (error) {
    console.error(`Error fetching ${type} posts:`, error);
    return [];
  }
};

/**
 * Get all published articles across collections
 * @param {string} lang - Language code (default: 'en')
 * @param {Function} filter - Additional filter function
 * @returns {Array} Array of all published posts
 */
export const getPublishedArticles_Content = async (lang = 'en', filter = () => true) => {
  try {
    // Get posts from all collections
    const [memorialPosts, newsPosts, articlePosts] = await Promise.all([
      getCollection('memorial', (post) => 
        post.data.language === lang && !post.data.draft && post.data.datePublished <= new Date()
      ),
      getCollection('news', (post) => 
        post.data.language === lang && !post.data.draft && post.data.datePublished <= new Date()
      ),
      getCollection('articles', (post) => 
        post.data.language === lang && !post.data.draft && post.data.datePublished <= new Date()
      )
    ]);
    
    // Combine all posts
    const allPosts = [...memorialPosts, ...newsPosts, ...articlePosts];
    
    return allPosts
      .filter(filter)
      .sort((a, b) => b.data.datePublished.getTime() - a.data.datePublished.getTime())
      .map(post => ({ ...post, helpers: getArticleHelpers(post) }));
  } catch (error) {
    console.error('Error fetching published articles:', error);
    return [];
  }
};

/**
 * Get post by URL/slug from any collection
 * @param {string} slug - Post URL slug
 * @returns {Object|null} Post object or null if not found
 */
export const getPostFromSlug_Content = async (slug) => {
  const collections = ['memorial', 'news', 'articles'];
  
  for (const collectionName of collections) {
    try {
      const posts = await getCollection(collectionName, (post) => post.data.url === slug);
      if (posts.length > 0) {
        const post = posts[0];
        return { ...post, helpers: getArticleHelpers(post) };
      }
    } catch (error) {
      console.warn(`Error searching in ${collectionName}:`, error);
    }
  }
  
  return null;
};

/**
 * Get post by ID from any collection
 * @param {string} id - Post ID
 * @returns {Object|null} Post object or null if not found  
 */
export const getPostFromID_Content = async (id) => {
  const collections = ['memorial', 'news', 'articles'];
  
  for (const collectionName of collections) {
    try {
      const post = await getEntry(collectionName, id);
      if (post) {
        return { ...post, helpers: getArticleHelpers(post) };
      }
    } catch (error) {
      // Entry not found in this collection, continue searching
    }
  }
  
  return null;
};

/**
 * Get all posts by author
 * @param {string} authorId - Author ID
 * @param {string} lang - Language code
 * @returns {Array} Posts by author
 */
export const getAllPostsByAuthor_Content = async (authorId, lang = 'en') => {
  try {
    const allPosts = await getPublishedArticles_Content(lang);
    return allPosts.filter(post => post.data.author === authorId);
  } catch (error) {
    console.error('Error fetching posts by author:', error);
    return [];
  }
};

/**
 * Get article translations
 * @param {string} slug - Article URL slug
 * @param {boolean} all - Include the current post
 * @returns {Array} Translation posts
 */
export const getArticleTranslations_Content = async (slug, all = false) => {
  try {
    const allPosts = await getPublishedArticles_Content();
    const thisPost = allPosts.find(post => post.data.url === slug);
    
    if (!thisPost) return [];
    
    // Extract base ID (everything before the language part)
    const baseid = (id) => id.split('/')[0];
    const thisBaseId = baseid(thisPost.id);
    
    let translations = allPosts.filter(post => baseid(post.id) === thisBaseId);
    
    if (!all) {
      translations = translations.filter(post => post.id !== thisPost.id);
    }
    
    return translations.map(post => ({ ...post, helpers: getArticleHelpers(post) }));
  } catch (error) {
    console.error('Error fetching article translations:', error);
    return [];
  }
};

/**
 * Get related posts based on topics
 * @param {string} slug - Current post slug
 * @returns {Array} Related posts
 */
export const getRelatedPosts_Content = async (slug) => {
  try {
    const allPosts = await getPublishedArticles_Content();
    const thisPost = allPosts.find(post => post.data.url === slug);
    
    if (!thisPost || !thisPost.data.topics || thisPost.data.topics.length === 0) {
      return [];
    }
    
    const topicsSet = new Set(thisPost.data.topics);
    const hasIntersection = (set, arr) => arr.some(item => set.has(item));
    
    const relatedPosts = allPosts.filter(post => {
      const isIntersection = hasIntersection(topicsSet, post.data.topics || []);
      const isSameArticle = post.id === thisPost.id;
      const isSameLanguage = post.data.language === thisPost.data.language;
      
      return isIntersection && !isSameArticle && isSameLanguage;
    });
    
    return relatedPosts.sort((a, b) => b.data.datePublished.getTime() - a.data.datePublished.getTime());
  } catch (error) {
    console.error('Error fetching related posts:', error);
    return [];
  }
};

// =============================================
// AUXILIARY DATA FUNCTIONS
// =============================================

/**
 * Load categories from JSON file
 * @returns {Array} Categories data
 */
export const getCategories_Content = async () => {
  try {
    const response = await fetch('/src/data/categories.json');
    return await response.json();
  } catch (error) {
    console.error('Error loading categories:', error);
    return [];
  }
};

/**
 * Load topics from JSON file
 * @returns {Array} Topics data
 */
export const getTopics_Content = async () => {
  try {
    const response = await fetch('/src/data/topics.json');
    return await response.json();
  } catch (error) {
    console.warn('No topics.json found, returning empty array');
    return [];
  }
};

/**
 * Load team data from JSON file
 * @returns {Array} Team data
 */
export const getTeam_Content = async () => {
  try {
    const response = await fetch('/src/data/team.json');
    return await response.json();
  } catch (error) {
    console.error('Error loading team data:', error);
    return [];
  }
};

/**
 * Get comments for a post
 * @param {string} postSlug - Post slug
 * @returns {Array} Comments for the post
 */
export const getCommentsForPost_Content = async (postSlug) => {
  try {
    const response = await fetch(`/src/data/comments/${postSlug}.json`);
    return await response.json();
  } catch (error) {
    console.warn(`No comments found for post: ${postSlug}`);
    return [];
  }
};

// =============================================
// HELPER FUNCTIONS
// =============================================

/**
 * Check if a post exists by slug
 * @param {string} slug - Post slug
 * @returns {boolean} True if post exists
 */
export const postExists_Content = async (slug) => {
  const post = await getPostFromSlug_Content(slug);
  return !!post;
};

/**
 * Generate sitemap articles for SEO
 * @returns {Array} Sitemap articles with translations
 */
export const getSitemapArticles_Content = async () => {
  try {
    const allPosts = await getPublishedArticles_Content();
    const enPosts = allPosts.filter(post => post.data.language === 'en');
    
    const getTranslations = (id) => {
      const baseid = id.split('/')[0];
      return allPosts
        .filter(post => post.id.split('/')[0] === baseid)
        .filter(post => post.id !== id);
    };
    
    const sitemapArticles = enPosts.map(post => ({
      loc: post.data.url,
      alternates: getTranslations(post.id).map(alt => ({
        href: alt.data.url,
        lang: alt.data.language
      }))
    }));
    
    return sitemapArticles;
  } catch (error) {
    console.error('Error generating sitemap articles:', error);
    return [];
  }
};