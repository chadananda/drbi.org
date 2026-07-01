// Content collection config. All live data is in Turso — these schemas are
// kept for type references only. No file-backed collections remain.
import { z, defineCollection } from 'astro:content';

export const LANG_CODES = ["ab","aa","af","ak","sq","am","ar","an","hy","as","av","ae","ay","az","bm","ba","eu","be","bn","bh","bi","bs","br","bg","my","ca","km","ch","ce","ny","zh","cu","cv","kw","co","cr","hr","cs","da","dv","nl","dz","en","eo","et","ee","fo","fj","fi","fr","fy","ff","gd","gl","lg","ka","de","ki","el","kl","gn","gu","ht","ha","he","hz","hi","ho","hu","is","io","ig","id","ia","ie","iu","ik","ga","it","ja","jv","kn","kr","ks","kk","rw","kv","kg","ko","kj","ku","ky","lo","la","lv","lb","li","ln","lt","lu","mk","mg","ms","ml","mt","mi","mr","mh","mn","na","nv","nd","ne","ng","nb","nn","no","ii","oc","oj","or","om","os","pa","pi","fa","pl","ps","pt","qu","rm","rn","ro","ru","sa","sc","sd","se","sm","sg","sr","gd","sn","si","sk","sl","so","st","es","su","sw","ss","sv","tl","ty","tg","ta","tt","te","th","bo","ti","to","ts","tn","tr","tk","tw","ug","uk","ur","uz","ve","vi","vo","wa","cy","wo","fy","xh","yi","yo","za","zu"] as const;
export type LanguageCode = typeof LANG_CODES[number];

export const POST_TYPES = ["Article","WebPage","Event","Organization","Person","LocalBusiness","Product","Recipe","Review","BreadcrumbList","Course","JobPosting","Movie","MusicAlbum","QAPage","SearchResultsPage","SoftwareApplication","VideoObject","BookReview","VideoReview","News","Memorial"] as const;
export type PostType = typeof POST_TYPES[number];

// Shared post schema — used by Turso shape functions for type reference
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
  topics: z.array(z.string()).default([]),
  keywords: z.array(z.string()).default([]),
  datePublished: z.coerce.date(),
  dateModified: z.coerce.date(),
  image: z.object({ src: z.string().optional().nullable(), alt: z.string().default('') }).optional(),
});

export type Post = z.infer<typeof postdb_schema>;

// No file-backed collections — all data is served from Turso at runtime.
export const collections = {};
