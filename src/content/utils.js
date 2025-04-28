// src/content/utils.js
import { getCollection } from 'astro:content';
import { getArticleHelpers } from '../utils/utils.js';

export const getPublishedPostsByType_Content = async (type, lang = 'en') => {
 const posts = await getCollection('postdb', (post) =>
   post.data.post_type === type &&
   post.data.language === lang &&
   !post.data.draft &&
   post.data.datePublished <= new Date()
 );
 return posts
   .sort((a, b) => b.data.datePublished.getTime() - a.data.datePublished.getTime())
   .map(post => ({ ...post, helpers: getArticleHelpers(post) }));
};

export const getArticleTranslations_Content = async (slug, all = false) => {
 const allPosts = await getCollection('postdb', (post) =>
   !post.data.draft && post.data.datePublished <= new Date()
 );
 const thisPost = allPosts.find(post => post.data.url === slug);
 if (!thisPost) return [];
 const baseid = (id) => id.split('/')[0];
 const thisBaseId = baseid(thisPost.id);
 let translations = allPosts.filter(post => baseid(post.id) === thisBaseId);
 if (!all) translations = translations.filter(post => post.id !== thisPost.id);
 return translations.map(post => ({ ...post, helpers: getArticleHelpers(post) }));
};





