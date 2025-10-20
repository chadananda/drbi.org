// utils.js
import slugifier from 'slugify';
import { getCollection } from 'astro:content';
// export a slugify function
import path from 'path';
import fs from 'fs';
import matter from 'gray-matter';
import site from '../data/site.json' with { type: 'json' };
import { getImage } from "astro:assets";
// Legacy Astro DB import - temporarily disabled during migration
// import { db, Categories, eq, Team, Users, Topics, Comments, inArray, NOW, Cron, Posts, count, lte, and } from 'astro:db';
import * as argon2 from 'argon2';
import AWS from 'aws-sdk';
import { Buffer } from 'buffer';
import dotenv from 'dotenv';  dotenv.config();
// import { moderateComments } from './openai_request';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import { marked } from 'marked';
import { create } from "domain";
// import { date } from "zod";
// import { code } from "@markdoc/markdoc/dist/src/schema";



// ***************** RAW DB Posts

export const genPostID = (title, datePublished, lang='en') => {
  const stopWords = 'a the and or of in on at to for with by'.split(' '); // add common words to exclude from slug
  // if (language!='en') return console.error('updatePost_DB: completely new post must be in English');
  let namePart = slugify(title).split('-').filter(w => !stopWords.includes(w)).slice(0, 4).join('-');
  let datePart = (new Date(datePublished)).toLocaleDateString('en-CA'); // YYYY-MM-DD
  return `${datePart}-${namePart}/${lang}.md`;
}
export const createPost_DB = async (id) => {
  // make sure to clean up
  if (id.endsWith('.mdoc')) id = id.replace('.mdoc', '.md');
  if (id.endsWith('index.md')) id = id.replace('index.md', 'en.md');
  let baseid = id.split('/')[0];
  // create post with id and baseid
  const exists = (await db.select().from(Posts).where(eq(Posts.id, id))).length > 0;
  if (!exists) await db.insert(Posts).values({id, baseid});
}
export const updatePostData_DB = async (id, newData) => {
  // clean up post id
  if (id.endsWith('.mdoc')) id = id.replace('.mdoc', '.md');
  if (id.endsWith('index.md')) id = id.replace('index.md', 'en.md');
  // update post data only, but not url
  await createPost_DB(id);
  // get existing fields, if any
  let data = (await db.select().from(Posts).where(eq(Posts.id, id)))[0];
  // clean up some fields
  if (newData.image && typeof newData.image === 'object') newData.image = newData.image.src;
  // sluggify keywords and topics
  if (newData.keywords) {
     newData.keywords = newData.keywords.map(kw => slugify(kw.trim())).filter(Boolean)
     newData.keywords = [...new Set(newData.keywords)];
  }
  // topics, slugify, clean and remove duplicates
  if (newData.topics) {
    newData.topics = newData.topics.map(topic => slugify(topic.trim())).filter(Boolean);
    newData.topics = [...new Set(newData.topics)];
  }
  // set modified field
  newData.dateModified = new Date();
  // update url if post is not published or it does not have a url
  const isPublished = !data.draft || data.datePublished<=new Date()
  newData.url = slugify(newData.title || data.title);
  if (isPublished && data.url) delete newData.url; // don't let it change if already published

  // don't let the newData override baseid for any reason
  if (newData.baseid) delete newData.baseid;
  // update modified fields
  data = {...data, ...newData}
  data.post_type = data.post_type || 'Article';
  data.datePublished = data.datePublished ? new Date(`${data.datePublished}`) : new Date();
  delete data.body; // we are not updating the body here
  // any more validation rules??

  // update record
  // console.log('Saving fields:', data);
  await db.update(Posts).set(data).where(eq(Posts.id, id));

  // if language === 'en' update fixed fields in all translations as well
  if (data.language==='en') {
    let {image, post_type, author, editor, category, topics, keywords, draft, audio_image, datePublished} = data
    let update = {image, post_type, author, editor, category, topics, keywords, draft, audio_image, datePublished};
    await db.update(Posts).set(update).where(eq(Posts.baseid, data.baseid));
  }
}
export const updatePostBody_DB = async (id, body) => {
  body = body.trim();
  if (!body) return;
  // clean up post id
  if (id.endsWith('.mdoc')) id = id.replace('.mdoc', '.md');
  if (id.endsWith('index.md')) id = id.replace('index.md', 'en.md');
  // update post body only
  await createPost_DB(id);
  // save
  const dateModified = new Date();
  body = `${body}\n\n`;
  await db.update(Posts).set({body, dateModified}).where(eq(Posts.id, id));
}
export const savePost_DB = async (id, data, body) => {
  // Database removed - mock save operation for compatibility
  console.log('savePost_DB called but database removed, mock saving:', { id, hasData: !!data, hasBody: !!body });
  return { success: true, message: 'Mock save successful' };
}
export const getPost_DB = async (id) => {
  // Database removed - return mock post data for compatibility
  console.log('getPost_DB called but database removed, returning mock data for:', id);
  return {
    id,
    title: 'Post Title',
    body: 'Post content...',
    language: 'en',
    draft: false,
    dateCreated: new Date().toISOString(),
    lastModified: new Date().toISOString()
  };
}
export const translationIDs_DB = async (id, all=true) => {
  let baseid = id.split('/')[0];
  let translations = await db.select().from(Posts).where(eq(Posts.baseid, baseid));
  if (!all) translations = translations.filter(post => post.id != id);
  return translations.map(({id}) => id);
}

// ***************** Entries

// updatePost requires a full post object with data and body, not a partial update
export const updatePost_DB = async (entry) => {
  // console.log('>>>> updatePost_DB', {  image: entry.data.image, id: entry.id });
  let { id, data, body } = entry;
  let { title, language, datePublished } = data; // required, even for body updates
  // if (type==='body') data = {}; else if (type==='body') data = {};
  let { post_type, url, description, desc_125, abstract,  audio, audio_duration, audio_image, narrator, draft, author, editor, category, topics,  keywords, image } = data;
  language = language || 'en';
  // if image is an object, make it a string
  if (typeof image === 'object') image = image.src;
  // replace index.mdoc with en.id  and  *.mdoc with *.md
  id = id || genPostID(title, datePublished);
  if (id.endsWith('.mdoc')) id = id.replace('.mdoc', '.md');
  if (id.endsWith('index.md')) id = id.replace('index.md', 'en.md');
  let baseid = id.split('/')[0];
  if (!url) url = slugify(title);

  const post = {
    id, baseid, url, title, post_type, description, desc_125, abstract, language,
    audio, audio_duration, audio_image, narrator, draft, author, editor, category,
    topics: (topics || []).map(topic => slugify(topic.trim())).filter(Boolean),
    keywords: (keywords || []).map(kw => slugify(kw.trim())).filter(Boolean), // Directly assigning JSON objects
    datePublished: new Date(datePublished),
    dateModified: new Date(), // Set the dateModified to NOW
    image, // Assume image field only needs the src as a string
    // post content
    body: `${body.trim()}\n\n`
  };

  try {
    // Check if the post already exists
    if (false) { // Database removed - always insert as new
      // if published, do not allow changes to the url
      if (!draft || datePublished<new Date()) delete post.url;
      // question: should we load the existing post and just update the changed fields?
      // Database removed - skip update
//console.log(`Updated post "${id}"`);
      // if English, update core fields in translations: image, post_type, author, editor, category, topics, keywords, draft, audio_image, date_published
      if (language==='en') {
        let updateObj = {image, post_type, author, editor, category, topics, keywords, draft, audio_image, datePublished};
        // Database removed - skip translation update
       // console.log('Updated translations matching:', baseid);
      }
    } else { // insert new post
      // on new post, set datePublished, dateModified, make sure id, slug and url are set
      // post.datePublished = new Date(); post.dateModified = new Date();
      if (!post.url) post.url = slugify(title);
      // If not found, insert as new without dateModified
//console.log(`Inserting new post...`, post.id);
      // Database removed - skip insert
    }
    return post;
  } catch (e) {
    console.error('error: ', e);
    return false;
  }
}
export const importPost2DB = async (id) => {
  let post = await getPostFromID(id)
  if (!post.db) await updatePost_DB(post)
}
export const postExists = async (id) => {
  const result = (await db.select({id: Posts.id}).from(Posts).where(eq(Posts.id, id))).length>0
  // this is inefficient. we should query a count instead of fetching the whole object
  // console.log('>>> postExists', {id, exists: result});
  return result
}

// export const postExists = async (id) => {
//   return (await db.select(count('*')).from(Posts).where(eq(Posts.id, id))) > 0
// }

export const importAllPosts2DB = async () => {
  console.log('Database removed - skipping import to database');
  return;
}
export const normalizePost_DB = (dbpost) =>  {
  let { id, url, title, post_type, description, desc_125, abstract, language, audio, audio_duration, audio_image, narrator, draft, author, editor, category, topics, tags, keywords, datePublished, dateModified, image, body, baseid } = dbpost;
  if (!url) url = slugify(title);
  // console.log('normalizePost_DB check 1', { image } );
// console.log('normalizePost_DB check 2', { audio, audio_image, audio_duration } );
  const entry = {
    id, slug: url, baseid, collection: "posts",
    data: {
      title, url, post_type, description, desc_125, abstract, language,
      audio, audio_duration, audio_image,
      narrator, draft, author, editor, category,
      topics: typeof topics === 'string' ? JSON.parse(topics) : topics,
      tags: typeof tags === 'string' ? JSON.parse(tags) : tags,
      keywords: typeof keywords === 'string' ? JSON.parse(keywords) : keywords,
      datePublished, dateModified,
      image: { src: image, alt: description},
    },
    body
  }
  // console.log('normalizePost_DB', entry);
  return entry;
};
export const newPostObj = (title, description, abstract='', desc_125='', body='') => {
  const datePublished = new Date(Date.now() + 604800000); // 604800000ms = 7 days
  const language = 'en';
  const id = genPostID(title, datePublished);
  const slug = slugify(title);
  const url = slug;
  const baseid = id.split('/')[0];
 return {
  id: '',
  slug: '',
  collection: 'posts',
  baseid,
  data: {
    title, url,
    post_type: 'Article',
    description, desc_125, abstract, language,
    audio: '', audio_duration: '', audio_image: '',
    narrator: 'auto',
    draft: true,
    author: '', editor: '',
    category: '', topics: [], keywords: [],
    datePublished, dateModified: new Date(),
    image: { src: '', alt: title }
  },
  body,
  db: true };
};
export const deletePost = async (postid) => {
  // we should not actually delete but turn the post into a redirect
  // but for now we will delete
   console.log('deleteing post', postid);
  // await db.delete(Posts).where(eq(Posts.id, postid));
}
export const getPosts_DB = async (lang = '', filter = () => true) => {
  // Database removed - return empty array for now
  console.log('getPosts_DB called but database removed, returning empty array');
  return [];
}

export const getPostFromSlug_DB = async (slug) => {
  const post = (await db.select().from(Posts).where(eq(Posts.url, slug)))
    .map(normalizePost_DB)
    .map(post => ({ ...post, db: true, helpers: getArticleHelpers(post) }))[0];
  return post;
}
export const getPostFromID_DB = async (id) => {
  const post = (await db.select().from(Posts).where(eq(Posts.id, id)))
    .map(normalizePost_DB)
    .map(post => ({ ...post, db: true, helpers: getArticleHelpers(post) }))[0];
  return post;
}
export const getArticleHelpers = (article) => {
  let { datePublished, author, draft, image } = article.data;
  if (!datePublished) datePublished = new Date();
    else if (typeof datePublished === 'string') datePublished = new Date(datePublished)
  const isPublished = (datePublished < new Date()) && !draft;
  return {
    isPublished,
    authorName: author?.replace(/(^|\s|-)\S/g, s => s.toUpperCase().replace('-', ' ')),
    datePublishedStr: (draft || !isPublished) ? '' : datePublished.toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' }),
    dateShort: datePublished.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    imgThumb: transformS3Url(image.src, 80,80),
    imgSmall:  transformS3Url(image.src, 120,120),
    imgMed: transformS3Url(image.src, 240, 180),
    imgLg: transformS3Url(image.src, 400,300),
    imgCover: transformS3Url(image.src, 1200,900),
  }
}
export const getAllCollectionArticles = async (lang='', filter=()=>true) => {
  const isBlank = (p) => p.data?.url?.toLowerCase().trim() === 'blank';
  const isLangMatch = (p) => !!lang ? p.data?.language === lang : true;
  // Load articles from the collection
  let posts = (await getCollection('posts', (p) => isLangMatch(p) && !isBlank(p)))
    .filter(filter);
  return posts;
}
export const getAllArticles = async (lang = '', filter = () => true) => {
  // make sure all collection posts are loadded into the database
  await importAllPosts2DB(); // we'll move this to a cron job or build step later

  const posts = (await getPosts_DB(lang, filter))
    .sort((a, b) => b.data.datePublished - a.data.datePublished)
    .map(post => ({ ...post, helpers: getArticleHelpers(post) })) // add helpers like images

    // posts.map(({data}) => console.log(`>>> article image loaded: `, JSON.stringify(data.image)));
  return posts;
}
export const getPublishedArticles = async (lang = 'en', max = 100) => {
  // Use new Content Layer API instead of old database
  const { getPublishedArticles_Content } = await import('./content-utils.js');
  const allPosts = await getPublishedArticles_Content(lang);
  return allPosts.slice(0, max);
}

export const getPublishedPosts = async (type = '', lang = 'en', max = 100) => {
  const { getPublishedArticles_Content, getPublishedPostsByType_Content } = await import('./content-utils.js');
  
  if (!type) {
    // Return all posts if no type specified
    const allPosts = await getPublishedArticles_Content(lang);
    return allPosts.slice(0, max);
  } else {
    // Return posts of specific type
    const posts = await getPublishedPostsByType_Content(type, lang);
    return posts.slice(0, max);
  }
}
// filter in query for speed, default to english
export const getPublishedPostsByType = async (type, lang='en') => {
  // we want to modify **the database query** to limit by type, language and published state (draft=false && datePublished<=NOW)
  // also, order by datePublished
  // let posts = await db.select().from(Posts).where(and(
  //   eq(Posts.post_type, type),
  //   eq(Posts.language, lang),
  //   eq(Posts.draft, false),
  //   lte(Posts.datePublished, NOW),
  // )).orderBy(Posts.datePublished, 'desc');
  // // console.log('getPublishedArticlesByType found', posts.length, 'posts of type: ', type);
  // const result = posts.map(normalizePost_DB)
  // return result;

  try {
    console.log('Querying posts of type:', type);

    // First try to get all posts
    const allPosts = await db.select().from(Posts);
    console.log('All posts in database:', allPosts.length);

    if (allPosts.length > 0) {
      console.log('Sample post:', allPosts[0]);
    }

    // Then try each filter one by one
    const typeFiltered = await db.select().from(Posts).where(eq(Posts.post_type, type));
    console.log('Posts after type filter:', typeFiltered.length);

    const langFiltered = await db.select().from(Posts).where(and(
      eq(Posts.post_type, type),
      eq(Posts.language, lang)
    ));
    console.log('Posts after language filter:', langFiltered.length);

    const draftFiltered = await db.select().from(Posts).where(and(
      eq(Posts.post_type, type),
      eq(Posts.language, lang),
      eq(Posts.draft, false)
    ));
    console.log('Posts after draft filter:', draftFiltered.length);

    // Finally, add the date filter
    const query = await db.select().from(Posts).where(and(
      eq(Posts.post_type, type),
      eq(Posts.language, lang),
      eq(Posts.draft, false),
      lte(Posts.datePublished, NOW),
    )).orderBy(Posts.datePublished, 'desc');

    console.log('Posts after all filters:', query.length);
    const result = query.map(normalizePost_DB);
    return result;
  } catch (error) {
    console.error('Error in getPublishedPostsByType:', error);
    return [];
  }


}

export const getAllPostsByAuthor = async (authorid, lang='en') => {
  let posts = await db.select().from(Posts).where(and(
    eq(Posts.language, lang),
    eq(Posts.author, authorid),
  )).orderBy(Posts.datePublished, 'desc');
  const result = posts.map(normalizePost_DB)
  return result;
}

export const getPostFromSlug = async (slug) => {
  // Redirect to Content Layer version during migration
  const { getPostFromSlug_Content } = await import('./content-utils.js');
  return await getPostFromSlug_Content(slug);
}
export const getPostFromID = async (id) => {
  // Redirect to Content Layer version during migration
  const { getPostFromID_Content } = await import('./content-utils.js');
  return await getPostFromID_Content(id);
}
// given a slug, return all matching translations, published or not
export const getArticleTranslationAll = async (slug, all=false) => {
  // we can make this better by gettting baseid
  //const baseid = (await db.select({baseid: Posts.baseid}).from(Posts).where(eq(Posts.url, slug)))[0];
  const post = (await db.select().from(Posts).where(eq(Posts.url, slug)))[0];
  if (!post) return []
  const baseid = post.baseid;
  let translations = (await db.select().from(Posts).where(eq(Posts.baseid, baseid)))
  if (!all) translations = translations.filter(post => post.url != slug);
  translations = translations.map(normalizePost_DB);
  return translations;
};
export const getArticleTranslations = async (slug, all=false) => {
  const allPosts = await getPublishedArticles();
  const thisPost = allPosts.filter(post => post.data.url === slug)[0];
  if (!thisPost) return []
  const baseid = (id) => id.split('/')[0];
  const thisBaseId = baseid(thisPost.id);
  let translations = allPosts.filter(({id}) => baseid(id) === thisBaseId)
  if (!all) translations = translations.filter(post => thisPost.id != post.id);
  return translations;
}
export const getRelatedPosts = async (slug) => {
 const allPosts = await getPublishedArticles();
 const thisPost = allPosts.filter(post => post.data.url===slug)[0]
 if (!thisPost || !thisPost.data.topics || thisPost.data.topics.length<1) return []
 const topicsSet = new Set(thisPost.data.topics); // without repitition
 const hasIntersection = (set, arr) => arr.some(item => set.has(item)); // why here?
 // now find all posts with topics in our set
 const relatedPosts = allPosts.filter((entry)=>{
   let isIntersection = hasIntersection(topicsSet, entry.data.topics);
   let isSameArticle = entry.id === thisPost.id;
   let isSameLanguage = entry.data.language === thisPost.data.language;
   // Now use the hasIntersection function by passing the Set and the array
   return isIntersection && !isSameArticle && isSameLanguage;
 });
 // sort posts by date
 relatedPosts.sort((a, b) => b.data.datePublished - a.data.datePublished);
 return relatedPosts;
}
// TODO: instead of a nested query, gather all aricles and filter them
export const getSitemapArticles = async () => {
  // const isPublished = (data) => !data.draft && data.datePublished <= new Date();
  // const basePosts = await getCollection('posts', ({ data }) => data.lang === 'en' && isPublished(data));
  const allPosts = await getPublishedArticles();
  const enPosts = allPosts.filter(post => (post.language==='en' || !post.language));
  const getTranslations = (id) => allPosts
    .filter(post => post.id.split('/')[0] = id.split('/')[0])
    .filter(post => id != post.id);
  // const enPosts = await getPublishedArticles('en');
  const sitemapArticles = enPosts.map((post) => { // this assumes a url at base
    const translations = getTranslations(post.id);
    const urlSet = {
      loc: post.data.url, // The primary article URL
      alternates: translations.map(alt => ({
        href: alt.data.url, // The alternate article URL TODO: check this!
        lang: alt.data.language // The language of the alternate article
      }))
    };
    return urlSet;
  });
  // const sitemapArticles = await Promise.all(sitemapArticlesPromises);
  return sitemapArticles;
};




// ********* POST tools
export const getArticleImageURL = async (slug, filename, full=false) => {
  let path = ''
  filename = filename.replace('./', '');
  let image = await getArticleImage(slug, filename);
  if (image) path = image.src;
  if (full) return site.url + path;
   else return path
}
export const getArticleAssetURL = async (slug, filename, full=false) => {
  if (!slug) return;
  let path
  let ar = await getPostFromSlug(slug);
  filename = filename.replace('./', '');
  path = '/posts/' + ar.id.split('/')[0] + '/' + filename;
  if (full) return site.url + path;
   else return path
}
export const generateArticleImage = async (imgfile, post=null, baseUrl="", width, height=100, format='webp', quality=80, alt="") => {
  if (imgfile?.src) imgfile = imgfile.src; // in case we get an object instead of a string
  // Ensure width and height are numbers, not objects
  width = width ? parseInt(width, 10) : 0;
  height = height ? parseInt(height, 10) : 100;
  alt = alt || post.data.title;
  let empty ={src:'', width, height, alt}
  if (!imgfile) {
    console.error('>> ERROR: generateArticleImage called with no imgfile');
    return empty;
  } // else console.log(" >>> converting image: ",  JSON.stringify(imgfile));
  // http image
  // console.log('generateArticleImage', { imgfile });
  if (imgfile.startsWith('http')) {
    const res = displayImageObj(imgfile, alt, width, height, format, quality);
    // console.log('displayImageObj returns: ', {imgfile, res})
    return res
  }
  // local images need a post object to locate the asset file
  try {
    if (!post || !post.id) { console.error('generateArticleImage: post not found'); return empty; }
    // console.log('base url', baseUrl);
    baseUrl = baseURL(baseUrl);
    // console.log('baseUrl', baseUrl);
    const asset = imgfile.replace('./', ''),
          imageKey = `/src/content/posts/${post?.id?.split('/')[0]}/${asset}`,
          images = await import.meta.glob('/src/content/posts/**/*.{jpeg,jpg,png,gif,webp,avif,svg}');
    const imageModule = images[imageKey];
    // failed to locate
    if (!imageModule) { console.error(`Image not found: ${imageKey}`); return empty; }
    // turn file into url
    const imageResult = await getImage({ src: imageModule(), width, height, format, quality });
    // console.log('generateArticleImage', { imageResult });
    const fullUrl = baseUrl + imageResult.src;
    // console.log('generateArticleImage', { fullUrl, width, height, format, quality, alt});
    return { src: fullUrl, width, height, alt };
  } catch (e) { console.error('Error processing local image:', e); return empty; }
};
export const getArticleImage = async (slug, filename, post=null) => {
  // return null;
//  console.log('getArticleImage', slug, filename);
  const entry = post || await getPostFromSlug(slug);
  const assetFolder = entry.id?.split('/')[0]
  const asset = filename.replace('./', '');
  const imagekey = `/src/content/posts/${assetFolder}/${asset}`;
  const images = await import.meta.glob('/src/content/posts/*/*.{jpeg,jpg,png,gif,webp,avif,svg}');
  const image = images[imagekey];
  if (!image) return console.error(`Image not found: ${imagekey}:`, images);
  try {
    return (await image())?.default;
  } catch (e) { console.error('getArticleImageURL', e); return null; }
}
export const getArticleAudioPath = async (slug, filename) => {
  // return '';
  // console.log('getArticleAudioPath', slug)
  const entry = await getPostFromSlug(slug);
  if (!entry) return console.error('getArticleAudioPath: entry not found:', slug, filename);
  const assetFolder = entry.id?.split('/')[0]
  const asset = filename.replace('./', '');
 //  console.log('getArticleAudioPath', `/${assetFolder}/${asset}`);
  return `/posts/${assetFolder}/${asset}`
}
// TODO: make this work with S3 links
export const getArticleAudioSize = async (slug, filename) => {
  // return 0;
  const entry = await getPostFromSlug(slug);
  // console.log('getArticleAudioPath', slug, filename)
  const assetFolder = ''+entry.id?.split('/')[0]
  const asset = filename.replace('./', '');
  const fullPath = path.resolve(process.cwd(), 'src/content/posts', assetFolder, asset);
  const stats = fs.statSync(fullPath);
  return stats.size; // Size in bytes
}
export const getArticleSlugFromURL = (url) => {
  // return '';
  let cleanURL = url.replace(/\/$/, ''); // remove trailing slash
  const pathname = new URL(cleanURL).pathname;
  // Decode the pathname to handle encoded characters
  const decodedPathname = decodeURIComponent(pathname);
  return decodedPathname.split('/').filter(Boolean).pop();
}




// ***************** Topics
export const getTopics = async (filter = ()=>true) => {
  // first load topics from the data collection
  let allTopics = (await getCollection('topics'))
  let allFaqs = (await getCollection('faqs'))
  let topics =  allTopics.map(topic => {
    let {topic_slug: id, topic: name, description} = topic.data;
    let {data} = allFaqs.find(f => f.id === id);
    let {title, faqs} = data;
    return {id, name, description, title, faqs, image:'', type:'collection' }
  });
  // Database removed - no database topics for now
  let dbTopics = [];
  // merge the two lists without duplications of id into a new array
  let mergedMap = new Map(topics.map(topic => [topic.id, topic]));
  dbTopics.forEach(dbTopic => mergedMap.set(dbTopic.id, dbTopic));
  let merged = Array.from(mergedMap.values());
  // filter the two lists & return result
  return merged.filter(filter);
}
export const updateTopic = async (values) => {
  let {id, name, title, description, image, faqs} = values;
  if (!id) return false;
  // unsluggify name from id with title case
  if (!name) name = id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  if (!faqs) faqs = [];
  faqs = JSON.stringify(faqs);

  try {
    if ((await db.select().from(Topics).where(eq(Topics.id, id))).length > 0) {
      // console.log(`Matching topic for "${id}" found, updating...`);
       await db.update(Topics).set({id, name, title, description, image, faqs}).where(eq(Topics.id, id));
    } else {
      //console.log(`No topic for "${id}" found, inserting...`);
       await db.insert(Topics).values({id, name, title, description, image, faqs})
     }
    return true;
  } catch (e) { console.error('updateCategory', e); return false; }
}
export const getTopic = async (id) => {
  // console.log('getTopic', id);
  // check if topic is an object or a string
  let result;
  if (!id) return result;
  let topic = await getDataCollectionEntry('topics', id);
  let faq = await getDataCollectionEntry('faqs', id);
  if (topic && faq) { // data collection
    const {topic: name, description} =  topic.data;
    const {title, faqs} = faq.data;
    result = { id, name, title, image: '', description, faqs };
// console.log('getTopic, from collection:', result);
  } else { // db
    result = (await db.select().from(Topics).where(eq(Topics.id, topic)))?.pop();
    // there are some bugs in drizzle/libsql wherein json objects are returned as strings. Deal with it:
    if (result && typeof result.faqs === 'string') try {
      result.faqs = JSON.parse(result.faqs);
    } catch (e) {
      console.error('JSON error:', e);
      result.faqs = [];
    }
  }
  return result;
}


// ***************** Comments

export const getComments = async (filter = () => true) => {
  console.log('getComments called but database removed, returning empty array');
  return [];
}
export const getCommentsForPost = async (postId) => {
  if (!postId) return [];
  
  try {
    const { promises: fs } = await import('fs');
    const path = await import('path');
    const commentsDir = path.join(process.cwd(), 'src/data/comments');
    const filePath = path.join(commentsDir, `${postId}.json`);
    
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    return Array.isArray(data) ? data : (data.comments || []);
  } catch (error) {
    // File doesn't exist or invalid JSON, return empty array
    return [];
  }
}
export const getComment = async (id) => {
  console.log('getComment called but database removed, returning null for:', id);
  return null;
}
export const getUnmoderatedComments = async () => {
  console.log('getUnmoderatedComments called but database removed, returning empty array');
  return [];
}
export const updateComment = async (comment) => {
  // fields are: {id, parentid, postid, name, content, date, starred}
  // console.log('updateComment', comment);
  try {
    if ((await db.select().from(Comments).where(eq(Comments.id, comment.id))).length > 0) {
      // console.log(`Matching comment for "${comment.id}" found, updating...`);
      delete comment.date; // this should not be updated
      await db.update(Comments).set(comment).where(eq(Comments.id, comment.id));
    } else {
      const {id, parentid, postid, name, content} = comment;
     // console.log(`Inserting new comment...`, {id, parentid, postid, name, content});
      await db.insert(Comments).values({id, parentid, postid, name, content})
     }
    return comment;
  } catch (e) { console.error('updateComment', e); return false; }
}
export const deleteComment = async (id) => {
  return await db.delete(Comments).where(eq(Comments.id, id));
}
export const deleteCommentsBatch = async (ids) => {
  //console.log('deleteCommmentsBatch', ids);
  if (!ids || ids.length<1) return;
  // delete with an array of ids in a single request
  await db.delete(Comments).where(inArray(Comments.id, ids));
}
// TODO: do in a single batch request?
export const updateCommentsBatch = async (comments) => {
  await comments.forEach(async comment => await updateComment(comment));
}
export const setModeratedBatch = async (ids) => {
 // console.log('setModeratedBatch', ids);
  if (!ids || ids.length<1) return;
  await db.update(Comments).set({moderated: true}).where(inArray(Comments.id, ids));
}
export const setStarredBatch = async (ids) => {
  if (!ids || ids.length<1) return;
  await db.update(Comments).set({starred: true}).where(inArray(Comments.id, ids));
}

// New Content Layer API version of comment moderation
export const moderateComments_openai_Content = async () => {
  try {
    const { getUnmoderatedComments_Content, updateCommentsModeration_Content } = await import('./comments-content-utils.js');
    const { getPostFromSlug } = await import('./content-utils.js');
    
    let allComments = await getUnmoderatedComments_Content();
    if (allComments.length === 0) {
      console.log('No unmoderated comments found');
      return;
    }
    
    console.log(`moderateComments_openai_Content: Processing ${allComments.length} comments`);
    
    // Get unique post IDs for context
    const postids = [...new Set(allComments.map(comment => comment.postid))];
    
    for (const postid of postids) {
      try {
        const postComments = allComments.filter(comment => comment.postid === postid);
        const post = await getPostFromSlug(postid);
        const description = post?.data?.description || `Comments for post: ${postid}`;
        
        console.log(`Processing ${postComments.length} comments for post: ${postid}`);
        
        // Create OpenAI moderation request
        const commentsText = postComments.map(comment => 
          `Comment by ${comment.name}: ${comment.content}`
        ).join('\n\n');
        
        // For now, auto-approve all comments (TODO: implement OpenAI moderation)
        for (const comment of postComments) {
          const moderated = true;
          const starred = false; // TODO: implement quality scoring
          
          await updateCommentsModeration_Content(comment.id, moderated, starred);
          console.log(`✅ Comment ${comment.id}: auto-approved`);
        }
        
        // Rate limiting - wait between posts
        await new Promise(resolve => setTimeout(resolve, 2000));
        
      } catch (error) {
        console.error(`Error moderating comments for post ${postid}:`, error);
      }
    }
    
  } catch (error) {
    console.error('Error in moderateComments_openai_Content:', error);
  }
}

export const moderateComments_openai = async () => {
  let allComments = await getUnmoderatedComments();
  // console.log('moderateComments_openai', allComments.length, allComments[0]);
  // call the api to moderate
  const postids = [...new Set(allComments.map(comment => comment.postid))];
  // console.log('moderating '+allComments.length+' comments for '+postids.length+' posts');
  for (const postid of postids) {
    const description = (await getPostFromSlug(postid))?.data?.description;
    const postComments = allComments.filter(c => c.postid === postid);
    // console.log('postComments for postid', postid, postComments[0]);
    const moderatedComments = await moderateComments(postComments, description);
    const approved = moderatedComments.filter(c => c.moderated).map(c => c.id)
    const starred = moderatedComments.filter(c => c.moderated && c.starred).map(c => c.id)
    const toDelete = moderatedComments.filter(c => !c.moderated).map(c => c.id)
    //console.log(`Page (${postid}):`, {approved, starred, toDelete});
    // set moderated in batch
    await setModeratedBatch(approved);
    // set starred in batch
    await setStarredBatch(starred);
    // delete comments that were not approved with an array of ids
    await deleteCommentsBatch(toDelete);
  }
}





// ***************** categories
export const getCategories = async (filter = () => true) => {
   // Database removed - return empty categories array
   console.log('getCategories called but database removed, returning empty array');
   return [];
}
export const getCategory = async (id) => {
  if (!id) return null;
  // let start = new Date().getTime();
  // Database removed - always return null
  console.log('getCategory called but database removed, returning null');
  return null;
}
export const categoryExists = async (id) => {
  // Database removed - always return false
  console.log('categoryExists called but database removed, returning false');
  return false;
}
export const updateCategory = async (values) => {
  let {id, category, description, image} = values;
  if (!id || !category || !description || !image) return false;
  try {
    if (await categoryExists(id)) {
      //  console.log(`Matching category for "${id}" found, updating...`);
       await db.update(Categories).set({id, category, description, image}).where(eq(Categories.id, id));
    } else {
      // console.log(`No category for "${id}" found, inserting...`);
       await db.insert(Categories).values({id, category, description, image})
     }
    return true;
  } catch (e) { console.error('updateCategory', e); return false; }
}
export const deleteCategory = async (id) => {
  return await db.delete(Categories).where(eq(Categories.id, id));
}


// ***************** Team
// TODO: simplify formatting to not use data collection format
export const getTeam = async (filter = () => true) => {
  // Read team from JSON file during migration
  const { readFileSync } = await import('fs');
  const { fileURLToPath } = await import('url');
  const path = await import('path');
  
  try {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const teamData = JSON.parse(readFileSync(path.join(__dirname, '../data/team.json'), 'utf8'));
    
    const team = teamData
      .map(row => ({id: row.id, type: "file", collection: 'team', data: row}))
      .filter(filter);
    
    return team;
  } catch (error) {
    console.error('Error loading team data:', error);
    return [];
  }
}
export const getTeamWithRole = async () => {
  // Use JSON data and add admin role
  const team = await getTeam();
  const adminEmail = import.meta.env.SITE_ADMIN_EMAIL?.trim().toLowerCase();
  
  return team.map(member => ({
    ...member.data,
    role: member.data.email === adminEmail ? 'superadmin' : 'author'
  }));
}
export const getTeamMember = async (slug) => { // formatted like data collection
 slug = slug?.id || `${slug}`; // handle either reference or string
 if (!slug) return null;
 
 try {
   const { readFileSync } = await import('fs');
   const { fileURLToPath } = await import('url');
   const path = await import('path');
   
   const __filename = fileURLToPath(import.meta.url);
   const __dirname = path.dirname(__filename);
   const teamData = JSON.parse(readFileSync(path.join(__dirname, '../data/team.json'), 'utf8'));
   
   const match = teamData.find(member => member.id === slug);
   if (match) return { id: match.id, type: "file", collection: 'team', data: match };
 } catch (error) {
   console.error('Error loading team member:', error);
 }
 
 return null;
}
export const getTeamMemberBySlug = async (slug) => {
  // Use JSON data instead of database
  return await getTeamMember(slug);
}
export const getTeamMemberByEmail = async (email) => {
  // Use JSON data instead of database - simplified for single admin
  const adminEmail = import.meta.env.SITE_ADMIN_EMAIL?.trim().toLowerCase();
  if (email === adminEmail) {
    return {
      id: site.author.toLowerCase().replace(/\s+/g, '-'),
      name: site.author,
      email: adminEmail,
      role: 'superadmin'
    };
  }
  return null;
}
export const deleteTeamMember = async (slug) => {
  // Team management disabled - using JSON data
  console.log('deleteTeamMember: Function disabled - using static JSON data');
  return null;
}

export const syncMemberUserEntry = async (member) => {
  // User management disabled - using environment variables for admin
  console.log('syncMemberUserEntry: Function disabled - using static admin configuration');
}

// TODO: query for user id instead of using 'isNew'
export const updateTeamMember = async (member, isNew) => {
  // Team management disabled - using JSON data
  console.log('updateTeamMember: Function disabled - using static JSON data');
  return false;
}



// ***************** MISC -- actual Utils

/**
 * Exportable component to render a JSON object as an HTML table with Tailwind CSS for compactness.
 * @param data - The JSON object to be rendered as a table.
 * @param columns - Array with names for the columns.
 * @returns A string containing the HTML markup for the table.
 */
export const JSONTable = (data, columns = ['Key', 'Value']) => {

  // console.log('JSONTable', data);
  if (!data) {
    console.error('JSONTable: no data provided');
    return '';
  }

  let tableRows = "";
  Object.keys(data).forEach((key) => {
    tableRows += `<tr class="border-b last:border-b-0">
                    <td class="px-2 py-1 text-sm">${key}</td>
                    <td class="px-2 py-1 text-sm whitespace-nowrap">${JSON.stringify(data[key], null, 2)}</td>
                  </tr>`;
  });
  return `
    <table class="w-full text-left table-fixed">
      <thead>
        <tr class="bg-gray-100">
          <th class="w-1/3 px-2 py-1 text-xs font-semibold">${columns[0]}</th>
          <th class="w-2/3 px-2 py-1 text-xs font-semibold">${columns[1]}</th>
        </tr>
      </thead>
      <tbody class="bg-white">
        ${tableRows}
      </tbody>
    </table>
  `;
}
export const guessContentType = (filename) => {
  const ext = path.extname(filename).toLowerCase();
  switch (ext) {
    case '.jpg': return 'image/jpeg';
    case '.jpeg': return 'image/jpeg';
    case '.png': return 'image/png';
    case '.gif': return 'image/gif';
    case '.webp': return 'image/webp';
    case '.avif': return 'image/avif';
    case '.svg': return 'image/svg+xml';
    case '.mp3': return 'audio/mpeg';
    case '.wav': return 'audio/wav';
    case '.ogg': return 'audio/ogg';
    case '.pdf': return 'application/pdf';
    case '.doc': return 'application/msword';
    case '.docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case '.xls': return 'application/vnd.ms-excel';
    case '.xlsx': return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    case '.ppt': return 'application/vnd.ms-powerpoint';
    case '.pptx': return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    case '.txt': return 'text/plain';
    case '.csv': return 'text/csv';
    default: return 'application/octet-stream';
  }
}
export const uploadS3 = async (base64Data, Key, ContentType='', Bucket='') => {
  // Configuring the AWS region and credentials
  const region = process.env.AWS_BUCKET_REGION; // 'us-east-1'
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
  ContentType = ContentType || guessContentType(Key)
  Bucket = process.env.AWS_BUCKET_NAME;


  if (!region) throw new Error('AWS_BUCKET_REGION not set');
  if (!accessKeyId) throw new Error('AWS_ACCESS_KEY_ID not set');
  if (!secretAccessKey) throw new Error('AWS_SECRET_ACCESS_KEY not set');
  if (!Bucket) throw new Error('AWS_BUCKET_NAME not set');
  if (!Key) throw new Error('Key not set');
  if (!ContentType) throw new Error('ContentType could not be determined');


  AWS.config.update({ region, accessKeyId, secretAccessKey });


// console.log('uploadS3 process.env.AWS_BUCKET_REGION', process.env.AWS_BUCKET_REGION);
// console.log('uploadS3 process.env.AWS_ACCESS_KEY_ID', process.env.AWS_ACCESS_KEY_ID);
// console.log('uploadS3 process.env.AWS_BUCKET_NAME', process.env.AWS_BUCKET_NAME);

  // Convert base64 string to binary buffer
  const Body = Buffer.from(base64Data, 'base64');
  // Create an S3 instance
  const s3 = new AWS.S3();
  // Setting up S3 upload parameters
  const params = {  Bucket, Key, Body, ContentType };
  try {
    const data = await s3.upload(params).promise();
    console.log(`File uploaded successfully at ${data.Location}`);
    return data.Location;
  } catch (err) {
   console.error('Error uploading file:', err);
    throw err;
  }
}
export const transformS3Url = (url = '', width = null, height = null, format = 'webp', quality=0) => {
  url = url || '';
  if (!url.includes('.s3.')) return url;
  const imagePath = new URL(url).pathname;
  // Ensure width and height are numbers, not objects
  width = width ? parseInt(width, 10) : null;
  height = height ? parseInt(height, 10) : null;
  let params = [];
  if (width && !isNaN(width)) params.push(`w=${width}`);
  if (height && !isNaN(height)) params.push(`h=${height}`);
  // set default quality
  if (quality===0 && width<400) quality = 100; else if (quality===0) quality = 80;
  params.push(`fm=${format}`, `q=${quality}`, `fit=crop`, `crop=faces`);
  // sharpen small images
  if (width<400) params.push('usm=20&usmrad=20'); else params.push('sharp=20')
  // add watermark ??
  // if (site.logo.includes('.s3.')) {
    // url encode site.logo to make a watermark
  // const watermark = Buffer.from(site.logo).toString('base64')
  // Base64.urlsafe_encode64(site.logo).delete('=')
  // params.push(`mark64=${watermark}`);//, `mark-alpha=10`, `mark-scale=10`);

  //  &mark64=aHR0cHM6Ly9iYWhhaS1lZHVjYXRpb24ub3JnL2Zhdmljb24uc3Zn&mark-scale=10&mark-alpha=10
  // }
  return `${site.img_base_url}${imagePath}?${params.join('&')}`;
}
export const displayImageObj = (url, alt='', width=0, height=0, format='webp', quality=80) => {
  // Ensure width and height are numbers, not objects
  width = width ? parseInt(width, 10) : 0;
  height = height ? parseInt(height, 10) : 0;
  // console.log(`>>> displayImageObj`, {url, src: (url, width, height, format, quality)});
  return {
    src: transformS3Url(url, width, height, format, quality),
    width, height, alt, isExternal: true
  }
}
export const baseURL = (Astro) => {
  let url = typeof Astro === 'string' ? Astro : Astro?.url?.href;
  if (!url) url = site.url;
  return url?.split('/').slice(0,3)?.join('/');
}
export const seedSuperUser = async () => {
  // No longer needed - admin user is configured via environment variables
  // console.log('seedSuperUser: Function deprecated - admin configured via environment variables');
}
export const currentURL = (Astro) => {
  // Ensure the URL doesn't end with a slash
  let cleanURL = Astro.url.href.replace(/\/$/, '');
  cleanURL = cleanURL.replace('[::1]', 'localhost'); // for dev
  // Decode the URL to handle encoded characters
  return decodeURIComponent(cleanURL);
}
export const hashstr = (str, len=8) => {
  let hash = btoa(String(str.split('').reduce((hash, char) => ((hash << 5) - hash) + char.charCodeAt(0), 0) >>> 0)); // Generate Base64 encoded hash
  return hash.slice(0, len)
}
// export const langFlag(lang) {
//   return mainLanguages[lang]?.flag;
// }
export const getUsedLanguages = async () => {
  const articles = await getPublishedArticles()
  const inLanguageList = (lang) => !!mainLanguages[lang];
  const inSiteList = (lang) => !!site.languages.includes(lang);
  let languages = new Set();
  // add any found language
  articles.forEach((post) => languages.add(post.data.language));
  // now convert back to array
  languages = Array.from(languages).filter(inLanguageList).filter(inSiteList)
  return languages;
}
export const mainLanguages = {
  en: { flag: "🇬🇧", name: "English", dir: "ltr", en_name: "English" },
  zh: { flag: "🇨🇳", name: "中文", dir: "ltr", en_name: "Chinese" },
  hi: { flag: "🇮🇳", name: "हिन्दी", dir: "ltr", en_name: "Hindi" },
  es: { flag: "🇪🇸", name: "Español", dir: "ltr", en_name: "Spanish" },
  fr: { flag: "🇫🇷", name: "Français", dir: "ltr", en_name: "French" },
  ar: { flag: "🇸🇦", name: "العربية", dir: "rtl", en_name: "Arabic" },
  bn: { flag: "🇧🇩", name: "বাংলা", dir: "ltr", en_name: "Bengali" },
  ru: { flag: "🇷🇺", name: "Русский", dir: "ltr", en_name: "Russian" },
  pt: { flag: "🇧🇷", name: "Português", dir: "ltr", en_name: "Portuguese" },
  ur: { flag: "🇵🇰", name: "اردو", dir: "rtl", en_name: "Urdu" },
  id: { flag: "🇮🇩", name: "Bahasa Indonesia", dir: "ltr", en_name: "Indonesian" },
  de: { flag: "🇩🇪", name: "Deutsch", dir: "ltr", en_name: "German" },
  ja: { flag: "🇯🇵", name: "日本語", dir: "ltr", en_name: "Japanese" },
  sw: { flag: "🇹🇿", name: "Kiswahili", dir: "ltr", en_name: "Swahili" },
  mr: { flag: "🇮🇳", name: "मराठी", dir: "ltr", en_name: "Marathi" },
  he: { flag: "🇮🇱", name: "עברית", dir: "rtl", en_name: "Hebrew" },
  fa: { flag: "🇮🇷", name: "فارسی", dir: "rtl", en_name: "Persian" },
  ro: { flag: "🇷🇴", name: "Română", dir: "ltr", en_name: "Romanian" },
  it: { flag: "🇮🇹", name: "Italiano", dir: "ltr", en_name: "Italian" },
  tr: { flag: "🇹🇷", name: "Türkçe", dir: "ltr", en_name: "Turkish" }
}
export const siteLanguages = () => {
  // a more efficient approach:
  let result = {};
  site.languages.forEach(lang => {
    if (mainLanguages[lang]) result[lang] = ({...mainLanguages[lang], code: lang});
  });
  return result;
}
export const slugify = (text) => {
  return slugifier(text,  {
    lower: true, // convert to lower case
    strict: true, // strip special characters except replacement
    remove: /[*+~.()'"!:@]/g, // remove characters that match regex, replace with replacement
  })
}
export const sanitizeHTML = (rawHTML) => {
  const window = new JSDOM('').window;
  const DOMPurify = createDOMPurify(window);
  return DOMPurify.sanitize(rawHTML);
}
export const renderMarkdown = (md) => {
  const rawHTML = marked(md);
  return sanitizeHTML(rawHTML);
};
export const buildToc = (post) => {
  const headings = MDHeadings(post.body);
  const toc = [], parentHeadings = new Map();
  headings.forEach(h => {
    const heading = { ...h, subheadings: [] };
    parentHeadings.set(heading.depth, heading);
    if (heading.depth === 2 || heading.depth === 3) {
      toc.push(heading);
    } else if (heading.depth > 3) {
      parentHeadings.get(heading.depth - 1)?.subheadings.push(heading);
    }
  });
  return toc;
}
export const MDHeadings = (mdContent) => {
  const headings = [];
  const renderer = new marked.Renderer();
  // Capture the original heading function of the renderer
  const originalHeading = renderer.heading.bind(renderer);
  // Override the heading function to extract headings
  renderer.heading = (text, level, raw, slugger) => {
    const slug = slugify(text);  // Ensure the slug is URL-friendly
    headings.push({ depth: level, text, slug });
    return originalHeading(text, level, raw, slugger);  // Call the original function to maintain default behavior
  };
  // Render the markdown to activate the custom renderer
  marked(mdContent, { renderer });
  return headings;
};
export const sanitizeInput = (str, maxlength = null) => {
  // Remove all script tags and everything between them
  str = str.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  // Remove html tags
  str = str.replace(/<[^>]*>/g, '');
  // Replace special characters but not foreign language characters or basic punctuation
  str = str.replace(/[^\w\s.,!?:;'"’“”-]/gu, '');
  // Change all tabs to spaces
  str = str.replace(/\t/g, ' ');
  // Collapse all whitespace (except line breaks) to single spaces
  str = str.replace(/[ \t]+/g, ' ');
  // Collapse line breaks (with optional whitespace) to single line breaks
  str = str.replace(/(\n\s*){3,}/g, '\n\n');
  // Replace HTML entities with their character
  str = str.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#039;/g, "'");
  // Trim whitespace from sides
  str = str.trim();
  // If maxlength is set, truncate to that length
  if (maxlength && str.length > maxlength) str = str.substring(0, maxlength);
  return str;
}
export const isValidEmail = (email) => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
export const toIsoStringWithTimezone = (d) => {
  let z = n => ('0' + n).slice(-2),
      off = d.getTimezoneOffset(),
      sign = off < 0 ? '+' : '-',
      padHours = z(Math.floor(Math.abs(off) / 60)),
      padMinutes = z(Math.abs(off) % 60);
  return d.getFullYear() + '-' + z(d.getMonth() + 1) + '-' + z(d.getDate()) +
         'T' + z(d.getHours()) + ':' + z(d.getMinutes()) + ':' + z(d.getSeconds()) +
         sign + padHours + ':' + padMinutes;
}

export const logoutUser = async (Astro) => {
  // how to delete Lucia session cookie?


  Astro.cookies.delete('session');
}

// server only

export const crontasks = async () => {
  // long running and expensive tasks on the server
  try {
    console.log('🔄 Running cron tasks...');
    
    // Check if we're running in development mode
    const isDev = process.env.NODE_ENV === 'development' || 
                  import.meta.env?.DEV || 
                  import.meta.env?.APP_ENV === 'dev' ||
                  typeof window !== 'undefined' && window.location?.hostname === 'localhost';
    
    console.log(`Environment: ${isDev ? 'Development (localhost)' : 'Production'}`);
    
    // Comment moderation now happens in real-time via API - no batch processing needed
    console.log('📝 Comment moderation handled in real-time - skipping batch processing');
    
    // Update events through the events API
    console.log('🔄 Syncing events from external sources...');
    
    try {
      // Use the events API for consistent handling
      // For server-side fetch, we need a full URL
      const baseUrl = process.env.NODE_ENV === 'development' ? 'http://localhost:4323' : site.url;
      const response = await fetch(`${baseUrl}/api/events`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'sync-external' })
      });
      
      if (response.ok) {
        const result = await response.json();
        if (result.hasChanges) {
          console.log('✅ Events were updated successfully');
        } else {
          console.log('✅ No event changes detected');
        }
      } else {
        console.error('❌ Failed to sync events:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('❌ Error syncing events:', error);
      // Fallback to direct scraper call if API fails
      console.log('🔄 Falling back to direct scraper...');
      const { updateEvents } = await import('./eventbrite-scraper.js');
      await updateEvents();
    }
    
    console.log('✅ All cron tasks completed');
  } catch (error) {
    console.error('❌ Error in cron tasks:', error);
  }
}
// File-based cron function - throttles crontasks to run max once per 5 minutes
export const poorMansCron = async () => {
  const cronFile = './cron-last-run.json';
  const fiveMinutes = 5 * 60 * 1000; // 5 minutes in milliseconds
  
  try {
    let lastRun = null;
    
    // Try to read the last run time from file
    try {
      const fs = await import('fs');
      const cronData = JSON.parse(fs.readFileSync(cronFile, 'utf8'));
      lastRun = new Date(cronData.cronjob);
    } catch (e) {
      // File doesn't exist or is invalid - first run
    }
    
    const now = new Date();
    const timeSinceLastRun = lastRun ? (now - lastRun) : fiveMinutes + 1;
    
    if (timeSinceLastRun > fiveMinutes) {
      console.log('poorMansCron: Running scheduled tasks...');
      await crontasks();
      
      // Update the last run time
      const fs = await import('fs');
      fs.writeFileSync(cronFile, JSON.stringify({ cronjob: now.toISOString() }));
      console.log('poorMansCron: Tasks completed');
    } else {
      const remaining = Math.ceil((fiveMinutes - timeSinceLastRun) / 1000);
      console.log(`poorMansCron: Skipping (${remaining}s remaining)`);
    }
  } catch (error) {
    console.error('poorMansCron error:', error);
  }
}



// ***************** Deprecated

// in order to migrate data collections to the DB, we need to write a
// wrapper function which fetches both the data collection and the data entry
// TODO: phase this out entirely (only comments remain)
// export const getDataCollection = async (collection, filter = () => true) => {
//   let  collectionItems = await getCollection(collection, filter);
//   // let table = null;
//   // let dbMatches = [];
//   // if (collection === 'categories') table = Categories;
//   //  else if (collection === 'faqs') table = Faqs;
//   //  else if (collection === 'keywords') table = Keywords;
//   //  else if (collection === 'team') table = Team;

//   // if (table) dbMatches = (await db.select().from(table))
//   //   .map(row=>({id: row.id, type: "db", collection, data: row})).filter(filter);
//   // Create a map to override local items with dbMatches based on id
//   // const merged = new Map(dbMatches.map(item => [item.id, item]));
//   // local.forEach(item => merged.set(item.id, item)); // Local items are added, but don't override existing dbMatches
//   // return Array.from(merged.values());

//   // console.log('getDataCollection', collection, dbMatches);

//   return collectionItems;
// }
// export const getDataCollectionEntry = async (collection, id) => {
//   return await getEntry(collection, id)


//   // let match = null, table = null;
//   // if (collection === 'categories') table = Categories;
//   // //  else if (collection === 'faqs') table = Faqs;
//   // //  else if (collection === 'keywords') table = Keywords;
//   // //  else if (collection === 'team') table = Team;

//   // // first try to fetch from the database
//   // if (table) match = (await db.select().from(table).where(  eq(table.category_slug, id) ))[0];
//   // if (match) match = { id, collection, data: match } // format like an astro content entry
//   //  else match = await getEntry(collection, id); // fall back on file system
//   // return match;
// }
export const getDataCollectionImage = async (collection, filename, imageType={format: 'jpg', width: 1000, height: 700}) => {
  if (!filename) return null;
  const {width, height, format} = imageType;
  if (filename.startsWith('http')) {
    //  https://bahai-education.org/_astro/bahai-literature.BmmHKzrh_2072vy.webp
    // later, when we use an image CDN, we can modify the url to set the size & format
    let finalImage;
    if (filename.includes(".s3.")) { // add s3 bucket later to be more specific
      let finalFormat = format || filename.split('.').pop();
      let newUrl = transformS3Url(filename, width, height, finalFormat, 80);
      finalImage = {width, height, format: finalFormat, src: newUrl, isExternal: true}
    } else finalImage = {width, height, format: format || filename.split('.').pop(), src: filename, isExternal: true}
    // console.log('finalImage http', finalImage);
    return finalImage;
  }
  const imagekey = `/src/content/${collection.collection}/${filename.replace('./', '')}`;
  const images = await import.meta.glob('/src/content/*/*.{jpeg,jpg,png,gif,webp,avif,svg}');
  const image = images[imagekey];
  if (!image) return console.error(`Image not found: ${imagekey}:`);
  try {
    const src = (await image())?.default;
    const dest = await getImage({ src, format, width, height }); // process according to request
    const finalImage = { src: dest.src,  width: dest.attributes.width, height: dest.attributes.height, format: dest.format || format };
    // console.log('finalImage', finalImage);
    return finalImage;
  } catch (e) { console.error('getDataCollectionImage', e); return null; }
}



// TODO: deprecated - for physical manipulation of Markdoc file
export const loadArticleRaw = async (slug, type='posts') => {
  const entry = await getPostFromSlug(slug);
  const filepath = path.join(process.cwd(), 'src/content', entry.collection, entry.id);
  // console.log('loadArticleRaw filepath:', filepath);
  const filedata = fs.readFileSync(filepath);
  const { data, content } = matter(filedata);
  return { data, content };
}

// === JSON File Comment System ===
export const saveCommentsToFile = async (postId, comments) => {
  if (!postId) throw new Error('Post ID is required');
  
  try {
    const { promises: fs } = await import('fs');
    const path = await import('path');
    const commentsDir = path.join(process.cwd(), 'src/data/comments');
    
    // Ensure directory exists
    try {
      await fs.access(commentsDir);
    } catch {
      await fs.mkdir(commentsDir, { recursive: true });
    }
    
    const filePath = path.join(commentsDir, `${postId}.json`);
    const sortedComments = comments.sort((a, b) => new Date(a.date) - new Date(b.date));
    
    await fs.writeFile(filePath, JSON.stringify(sortedComments, null, 2));
    return true;
  } catch (error) {
    console.error('Error saving comments:', error);
    throw error;
  }
}

export const addCommentToFile = async (postId, comment) => {
  const existingComments = await getCommentsForPost(postId);
  
  const newComment = {
    id: comment.id || Math.random().toString(36).substr(2, 12),
    postid: postId,
    parentid: comment.parentid || null,
    name: comment.name,
    content: comment.content,
    date: comment.date || new Date().toISOString(),
    moderated: true,
    starred: comment.starred || false,
    ai_score: comment.ai_score || null
  };
  
  const updatedComments = [...existingComments, newComment];
  await saveCommentsToFile(postId, updatedComments);
  
  return newComment;
}

export const moderateCommentWithOpenAI = async (comment, postDescription = '') => {
  const openaiKey = process.env.OPENAI;
  
  if (!openaiKey) {
    console.error('OpenAI API key not found');
    return { approved: true, reason: 'No API key configured', confidence: 0.5 };
  }

  try {
    const prompt = `You are a comment moderator for a religious/spiritual website about the Baha'i Faith. 

Post context: "${postDescription}"

Comment to moderate:
Name: ${comment.name}
Content: ${comment.content}

Please evaluate this comment and respond with ONLY a JSON object in this exact format:
{
  "approved": true/false,
  "reason": "brief explanation",
  "confidence": 0.0-1.0
}

Approve comments that are respectful, constructive, related to the topic, or express genuine thoughts.
Reject comments that are spam, offensive, completely off-topic, or contain inappropriate links.
Be lenient with approval - only reject clearly problematic content.`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 150,
        temperature: 0.3
      })
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content?.trim();
    
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    try {
      const result = JSON.parse(content);
      if (typeof result.approved !== 'boolean') {
        throw new Error('Invalid response format');
      }
      
      return {
        approved: result.approved,
        reason: result.reason || 'No reason provided',
        confidence: result.confidence || 0.5
      };
      
    } catch (parseError) {
      console.error('Error parsing OpenAI response:', parseError, content);
      const approved = !content.toLowerCase().includes('reject') && 
                      !content.toLowerCase().includes('inappropriate');
      
      return {
        approved,
        reason: 'Parse error - manual review needed',
        confidence: 0.3
      };
    }

  } catch (error) {
    console.error('OpenAI moderation error:', error);
    return {
      approved: true,
      reason: `API error: ${error.message}`,
      confidence: 0.1
    };
  }
}

export const commitCommentToGitHub = async (filePath, commitMessage) => {
  const token = process.env.GITHUB_PERSONAL_ACCESS_TOKEN;
  const repo = process.env.GITHUB_REPO || 'chadananda/drbi.org';
  const branch = process.env.GITHUB_BRANCH || 'main';
  
  if (!token || process.env.NODE_ENV !== 'production') {
    return; // Skip in development
  }
  
  try {
    const { promises: fs } = await import('fs');
    const path = await import('path');
    
    const fullPath = path.join(process.cwd(), filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    const base64Content = Buffer.from(content).toString('base64');
    
    // Get current file SHA
    let currentSha = null;
    try {
      const getResponse = await fetch(
        `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${branch}`,
        {
          headers: {
            'Authorization': `token ${token}`,
            'Accept': 'application/vnd.github.v3+json'
          }
        }
      );
      
      if (getResponse.ok) {
        const fileData = await getResponse.json();
        currentSha = fileData.sha;
      }
    } catch (error) {
      console.log('File does not exist on GitHub, creating new file');
    }
    
    const payload = {
      message: commitMessage,
      content: base64Content,
      branch: branch
    };
    
    if (currentSha) {
      payload.sha = currentSha;
    }
    
    const response = await fetch(
      `https://api.github.com/repos/${repo}/contents/${filePath}`,
      {
        method: 'PUT',
        headers: {
          'Authorization': `token ${token}`,
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      }
    );
    
    if (!response.ok) {
      const error = await response.text();
      throw new Error(`GitHub API error: ${response.status} - ${error}`);
    }
    
    const result = await response.json();
    console.log(`Successfully committed ${filePath} to GitHub:`, result.commit.html_url);
    
  } catch (error) {
    console.error('GitHub commit error:', error);
  }
}

// =============================================
// SITE SETTINGS MANAGEMENT
// =============================================

/**
 * Update site settings in site.json file
 * @param {Object} settings - Settings object to update
 * @param {string} author - Author name for commit
 * @param {string} email - Author email for commit
 * @returns {Promise<Object>} Result object with success status
 */
export async function updateSiteSettings(settings, author = 'DRBI Admin', email = 'admin@drbi.org') {
  try {
    // Read current site.json
    const siteJsonPath = path.join(process.cwd(), 'src/data/site.json');
    const currentSiteData = JSON.parse(fs.readFileSync(siteJsonPath, 'utf8'));
    
    // Update with new settings, handling nested objects
    const updatedSiteData = {
      ...currentSiteData,
      title: settings.siteName || currentSiteData.title,
      subtitle: settings.siteTagline || currentSiteData.subtitle,
      description: settings.siteDescription || currentSiteData.description,
      url: settings.siteUrl || currentSiteData.url,
      email: settings.adminEmail || currentSiteData.email,
      phone: settings.phone || currentSiteData.phone,
      address: settings.address || currentSiteData.address,
      
      // Social media - preserve existing structure
      facebook: {
        ...currentSiteData.facebook,
        publisher: settings.facebook || currentSiteData.facebook?.publisher
      },
      twitter: {
        ...currentSiteData.twitter,
        site: settings.twitter || currentSiteData.twitter?.site
      },
      youtube: {
        ...currentSiteData.youtube,
        channel_name: settings.youtube || currentSiteData.youtube?.channel_name
      },
      
      // New fields for content settings
      postsPerPage: settings.postsPerPage ? parseInt(settings.postsPerPage) : currentSiteData.postsPerPage || 10,
      eventsPerPage: settings.eventsPerPage ? parseInt(settings.eventsPerPage) : currentSiteData.eventsPerPage || 12,
      enableComments: settings.enableComments === 'on',
      moderateComments: settings.moderateComments === 'on',
      
      // Add Instagram if provided
      ...(settings.instagram && { instagram: settings.instagram })
    };
    
    // Convert to formatted JSON
    const updatedContent = JSON.stringify(updatedSiteData, null, 2);
    
    let result = {
      success: true,
      method: 'local'
    };
    
    // Check if we should use GitHub (production environment or explicit flag)
    const useGitHub = process.env.GITHUB_PERSONAL_ACCESS_TOKEN && 
                      (process.env.VERCEL || process.env.CMS_USE_GITHUB === 'true');
    
    if (useGitHub) {
      try {
        // Commit to GitHub using existing function
        await commitToGitHub(
          'src/data/site.json',
          updatedContent,
          'Update site settings via Admin Panel',
          author,
          email
        );
        result.method = 'github';
        console.log('✅ Site settings updated on GitHub');
      } catch (error) {
        console.error('GitHub update failed, falling back to local:', error);
        // Fallback to local update
        fs.writeFileSync(siteJsonPath, updatedContent, 'utf8');
        result.method = 'local_fallback';
        result.error = error.message;
      }
    } else {
      // Update locally
      fs.writeFileSync(siteJsonPath, updatedContent, 'utf8');
      console.log('✅ Site settings updated locally');
    }
    
    return result;
    
  } catch (error) {
    console.error('Error updating site settings:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

