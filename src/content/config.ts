// 1. Import utilities from `astro:content`
import { z, defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';


export const LANG_CODES = ["ab","aa","af","ak","sq","am","ar","an","hy","as","av","ae","ay","az","bm","ba","eu","be","bn","bh","bi","bs","br","bg","my","ca","km","ch","ce","ny","zh","cu","cv","kw","co","cr","hr","cs","da","dv","nl","dz","en","eo","et","ee","fo","fj","fi","fr","fy","ff","gd","gl","lg","ka","de","ki","el","kl","gn","gu","ht","ha","he","hz","hi","ho","hu","is","io","ig","id","ia","ie","iu","ik","ga","it","ja","jv","kn","kr","ks","kk","rw","kv","kg","ko","kj","ku","ky","lo","la","lv","lb","li","ln","lt","lu","mk","mg","ms","ml","mt","mi","mr","mh","mn","na","nv","nd","ne","ng","nb","nn","no","ii","oc","oj","or","om","os","pa","pi","fa","pl","ps","pt","qu","rm","rn","ro","ru","sa","sc","sd","se","sm","sg","sr","gd","sn","si","sk","sl","so","st","es","su","sw","ss","sv","tl","ty","tg","ta","tt","te","th","bo","ti","to","ts","tn","tr","tk","tw","ug","uk","ur","uz","ve","vi","vo","wa","cy","wo","fy","xh","yi","yo","za","zu"] as const;

export type LanguageCode = typeof LANG_CODES[number];

export const POST_TYPES = ["Article","WebPage","Event","Organization","Person","LocalBusiness","Product","Recipe","Review","BreadcrumbList","Course","JobPosting","Movie","MusicAlbum","QAPage","SearchResultsPage","SoftwareApplication","VideoObject","BookReview","VideoReview","News"] as const;

export type PostType = typeof POST_TYPES[number];






// New schema with transformation
export const postdb_schema = z.object({
  title: z.string().max(100).default(""),
  url: z.string().max(100).default(""),
  post_type: z.enum(POST_TYPES).default("Article"),
  description: z.string().max(160).default(""),
  desc_125: z.string().default(""),
  abstract: z.string().default(""),
  language: z.enum(LANG_CODES).default("en"),
  audio: z.string().optional().nullable(),
  audio_duration: z.string().nullable().default(""),
  audio_image: z.string().optional().nullable(),
  narrator: z.string().nullable().default("auto"),
  draft: z.boolean().default(true),
  author: z.string().nullable().optional(),
  editor: z.string().nullable().optional(),
  category: z.string().nullable().optional(),
  topics: z.string().optional(),
  tags: z.string().optional(),
  keywords: z.string().optional(),
  datePublished: z.coerce.date(),
  dateModified: z.coerce.date(),
  image: z.string().optional()
});

export type Post = z.infer<typeof postdb_schema>;

// Parallel implementation with normalized data
export const postdb = defineCollection({
  type: 'content',
  schema: postdb_schema.transform((data) => ({
    ...data,
    topics: tryParseJSON(data.topics, []),
    tags: tryParseJSON(data.tags, []),
    keywords: tryParseJSON(data.keywords, []),
    image: {
      src: data.image || '',
      alt: data.description || ''
    }
  }))
});



// old schema which required normalization
export const post_schema = ({ image }) =>
  z.object({
    title: z.string().max(100).default(""),
    url: z.string().max(100).default(""),
    post_type: z.enum(POST_TYPES).default("Article"),

    description: z.string().max(160).default(""), // 160 char limit
    desc_125: z.string().default(""), // short description for RSS feed
    abstract: z.string().default(""), // longer, like 500 chars min

    language: z.enum(LANG_CODES).default("en"),
    audio: z.string().optional().nullable(),// url to audio file
    audio_duration: z.string().nullable().default(""), // duration of audio in ISO 8601 format
    audio_image: z.string().optional().nullable(),// image for audio
    narrator: z.string().nullable().default("auto"), // auto generated or name of narrator
    draft: z.boolean().default(true),

    author: z.string().nullable().optional(), //reference("team").nullable().optional(),
    editor: z.string().nullable().optional(), //reference("team").nullable().optional(),
    category: z.string().nullable().optional(),
    topics: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    keywords: z.array(z.string()).default([]), // will be an array of references soon!

    datePublished: z
      .string()
      .transform((str) => new Date(str))
      .default(""),
    dateModified: z
      .string()
      .transform((str) => new Date(str))
      .default(""), // do we need?

    // image: z.string().nullable().default("")
    image: z.object({
      src: z.string().optional().nullable(), // Validate as URL or any string
      alt: z.string().default('')
    }).optional(),

  });
// Main 'post' collection, for all article types
export const posts = defineCollection({
  type: 'content', schema: post_schema,
});

// collection: topics:
export const topics = defineCollection({
  type: 'data',
  schema: z.object({
    topic: z.string(),
    topic_slug: z.string(),
    category: z.string().nullable().default(''),
    traffic: z.number().default(0),
    description: z.string().nullable().default(''),
  }),
});

// define collection for faqs:
export const faqs = defineCollection({
  type: 'data',
  schema: z.object({
    topic: z.string(),
    topic_slug: z.string(),
    category: z.string(),
    title: z.string(),
    description: z.string(),
    faqs: z.array(z.object({
      question: z.string(),
      answer: z.string(),
      // resources: z.array(reference('articles')).optional(),
    })),
  }),
});

export const comments = defineCollection({
  type: 'data',
  schema: z.object({
    lastPostDate:  z.string().transform(str => new Date(str)).default(''),
    comments: z.array(z.object({
      postid: z.string(),
      parentid: z.string().nullable().default(null),
      name: z.string(),
      email: z.string().nullable().default(''),
      date: z.string().transform(str => new Date(str)).default(''),
      content: z.string(),
      starred: z.boolean().default(false),
    }))
  })
});

// Helper function for safe JSON parsing
function tryParseJSON(str: string | undefined | null, defaultValue: any[] = []) {
  if (!str) return defaultValue;
  try {
    return JSON.parse(str);
  } catch {
    return defaultValue;
  }
}

// ==============================
// NEW ASTRO 5.0 CONTENT COLLECTIONS
// ==============================

// Schema for the new file-based memorial posts
const memorialSchema = z.object({
  title: z.string(),
  description: z.string(),
  desc_125: z.string().optional(),
  abstract: z.string().optional(),
  post_type: z.string().default("Memorial"),
  url: z.string(),
  language: z.enum(LANG_CODES).default("en"),
  draft: z.boolean().default(false),
  author: z.string().optional(),
  editor: z.string().optional(),
  category: z.string().optional(),
  topics: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  datePublished: z.coerce.date(),
  dateModified: z.coerce.date(),
  image: z.object({
    src: z.string(),
    alt: z.string()
  }).optional(),
  audio: z.string().optional(),
  audio_duration: z.string().optional(),
  audio_image: z.string().optional(),
  narrator: z.string().optional()
});

// Schema for news posts
const newsSchema = memorialSchema.extend({
  post_type: z.string().default("News")
});

// Schema for articles
const articlesSchema = memorialSchema.extend({
  post_type: z.string().default("Article")
});

// Define the new file-based collections
export const memorial = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/memorial" }),
  schema: memorialSchema
});

export const news = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/news" }),
  schema: newsSchema
});

export const articles = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/articles" }),
  schema: articlesSchema
});

// Export all collections for Astro
export const collections = {
  // Legacy collections (to be deprecated)
  posts,
  postdb,
  topics,
  faqs,
  comments,
  
  // New file-based collections (Astro 5.0)
  memorial,
  news,
  articles
};

