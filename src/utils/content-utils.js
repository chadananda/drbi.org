// Content utilities — all reads go through Turso (queries.ts).
// Preserves the same function signatures as the old content-collection version.

import { getArticleHelpers } from './utils.js';
import {
  getAllContent,
  getContentByCollection,
  getContentBySlug,
  getContentById,
  getCategories as getCategoriesTurso,
  getTopics as getTopicsTurso,
  getTeam as getTeamTurso,
} from '../lib/queries';

const TYPE_TO_COLLECTION = {
  memorial: 'memorial',
  news: 'news',
  article: 'articles',
  articles: 'articles',
};

function withHelpers(post) {
  return { ...post, helpers: getArticleHelpers(post) };
}

function isPublished(post) {
  return !post.data.draft && post.data.datePublished <= new Date();
}

export const getPublishedPostsByType_Content = async (type, lang = 'en') => {
  const collection = TYPE_TO_COLLECTION[type.toLowerCase()] ?? 'articles';
  const posts = await getContentByCollection(collection);
  return posts
    .filter(p => p.data.language === lang && isPublished(p))
    .sort((a, b) => b.data.datePublished - a.data.datePublished)
    .map(withHelpers);
};

export const getPublishedArticles_Content = async (lang = 'en', filter = () => true) => {
  const posts = await getAllContent();
  return posts
    .filter(p => p.data.language === lang && isPublished(p) && filter(p))
    .sort((a, b) => b.data.datePublished - a.data.datePublished)
    .map(withHelpers);
};

export const getPostFromSlug_Content = async (slug) => {
  const post = await getContentBySlug(slug);
  return post ? withHelpers(post) : null;
};

// alias used by utils.js and comments.js
export const getPostFromSlug = getPostFromSlug_Content;

export const getPostFromID_Content = async (id) => {
  const post = await getContentById(id);
  return post ? withHelpers(post) : null;
};

export const getAllPostsByAuthor_Content = async (authorId, lang = 'en') => {
  const posts = await getPublishedArticles_Content(lang);
  return posts.filter(p => p.data.author === authorId);
};

export const getArticleTranslations_Content = async (slug, all = false) => {
  const allPosts = await getPublishedArticles_Content();
  const thisPost = allPosts.find(p => p.data.url === slug);
  if (!thisPost) return [];
  const baseid = (id) => id.split('/')[0];
  const thisBase = baseid(thisPost.id);
  let translations = allPosts.filter(p => baseid(p.id) === thisBase);
  if (!all) translations = translations.filter(p => p.id !== thisPost.id);
  return translations;
};

export const getRelatedPosts_Content = async (slug) => {
  const allPosts = await getPublishedArticles_Content();
  const thisPost = allPosts.find(p => p.data.url === slug);
  if (!thisPost?.data.topics?.length) return [];
  const topicSet = new Set(thisPost.data.topics);
  return allPosts
    .filter(p => p.id !== thisPost.id && p.data.language === thisPost.data.language && p.data.topics?.some(t => topicSet.has(t)))
    .sort((a, b) => b.data.datePublished - a.data.datePublished);
};

export const getCategories_Content = async () => {
  const cats = await getCategoriesTurso();
  return cats.map(c => c.data ?? c);
};

export const getTopics_Content = async () => {
  const topics = await getTopicsTurso();
  return topics.map(t => t.data ?? t);
};

export const getTeam_Content = async () => {
  const team = await getTeamTurso();
  return team.map(m => m.data ?? m);
};

export const getCommentsForPost_Content = async (_postSlug) => [];

export const postExists_Content = async (slug) => !!(await getContentBySlug(slug));

export const getSitemapArticles_Content = async () => {
  const allPosts = await getPublishedArticles_Content();
  const enPosts = allPosts.filter(p => p.data.language === 'en');
  const baseid = (id) => id.split('/')[0];
  return enPosts.map(post => ({
    loc: post.data.url,
    alternates: allPosts
      .filter(p => baseid(p.id) === baseid(post.id) && p.id !== post.id)
      .map(p => ({ href: p.data.url, lang: p.data.language })),
  }));
};
