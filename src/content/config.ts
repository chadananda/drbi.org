// 1. Import utilities from `astro:content`
import { string } from 'astro/zod';
import { z, defineCollection, reference } from 'astro:content';

const LANG_CODES = [
  'ab','aa','af','ak','sq','am','ar','an','hy','as','av','ae','ay','az',
  'bm','ba','eu','be','bn','bh','bi','bs','br','bg','my','ca','km','ch',
  'ce','ny','zh','cu','cv','kw','co','cr','hr','cs','da','dv','nl','dz',
  'en','eo','et','ee','fo','fj','fi','fr','fy','ff','gd','gl','lg','ka',
  'de','ki','el','kl','gn','gu','ht','ha','he','hz','hi','ho','hu','is',
  'io','ig','id','ia','ie','iu','ik','ga','it','ja','jv','kn','kr','ks',
  'kk','rw','kv','kg','ko','kj','ku','ky','lo','la','lv','lb','li','ln',
  'lt','lu','mk','mg','ms','ml','mt','mi','mr','mh','mn','na','nv','nd',
  'ne','ng','nb','nn','no','ii','oc','oj','or','om','os','pa','pi','fa',
  'pl','ps','pt','qu','rm','rn','ro','ru','sa','sc','sd','se','sm','sg',
  'sr','gd','sn','si','sk','sl','so','st','es','su','sw','ss','sv','tl',
  'ty','tg','ta','tt','te','th','bo','ti','to','ts','tn','tr','tk','tw',
  'ug','uk','ur','uz','ve','vi','vo','wa','cy','wo','fy','xh','yi','yo',
  'za','zu'
];

const POST_TYPES = ["Article", "WebPage", "Event", "Organization", "Person", "LocalBusiness", "Product", "Recipe", "Review", "BreadcrumbList", "Course", "JobPosting", "Movie", "MusicAlbum", "QAPage", "SearchResultsPage", "SoftwareApplication", "VideoObject", "Newsletter"];

const ORG_TYPE = ["Organization", "Corporation", "GovernmentOrganization", "NGO", "EducationalOrganization", "SportsTeam", "MusicGroup", "PerformingGroup", "NewsMediaOrganization", "FundingScheme", "LibrarySystem", "MedicalOrganization", "WorkersUnion", "Consortium", "Airline", "Brand"];


// 2. Define your collection(s)
const posts = defineCollection({
  type: 'content',
  schema: ({ image }) => z.object({
    title: z.string(),
    post_slug: z.string().default(''),
    post_type: z.enum(POST_TYPES).default('Article'),
    description: z.string().max(160).default(''),
    language: z.enum(LANG_CODES).default('en'),
    draft: z.boolean(),

    category: reference('categories'),
    author: reference('team'),
    topics: z.array(reference('topics')).optional(),

    tags: z.array(z.string()).optional(), // is this still needed?
    keywords: z.array(z.string()).default([]), // will be an array of references soon!

    // shouldn't these be actual dates?
    datePublished: z.string().transform(str => new Date(str)).default(''),
    dateModified: z.string().transform(str => new Date(str)).default(''),

    image: z.object({
      src: image().refine((img) => img.width >= 600,{
        message: "Image must be at least 600 pixels wide!",
      }),
      alt: z.string(),
    }),

    podcast_main: z.object({
      audio: z.string().default(''),
      title: z.string().default(''),
      description: z.string().default(''),
      duration: z.string().default(''),
      image: z.string().default(''),
      episodeNumber: z.number().default(1),
      seriesName: z.string().default(''),
    }).default({}),

    // maybe replace this with a defined summary field?
    tldr: z.object({
      title: z.string().default(''),
      content: z.string().default(''),
      link: z.string().default(''),
      linkText: z.string().default(''),
    }).default({}),

    video_main: z.object({
      videoURL: z.string().default(''),
      title: z.string().default(''),
      description: z.string().default(''),
      duration: z.string().default(''),
      image: z.string().default(''),
      transcript: z.string().default(''),
    }).default({}),

  }),
});



const team = defineCollection({
  type: 'data',
  schema: ({ image }) => z.object({
    name: z.string(),
    name_slug: z.string().default(''),
    title: z.string(),

    image: z.object({
      src: image().refine((img) => img.width >= 200,{
        message: "Image must be at least 200 pixels wide!",
      }),
      alt: z.string(),
    }),


    draft: z.boolean().default(false),
    jobTitle: z.string().default(''),
    type: z.string().default('Person'),
    url: z.string().default(''),
    worksFor: z.object({
      '@type': z.enum(ORG_TYPE).default('Organization'),
      name: z.string().default(''),
    }).default({}),
    description: z.string().default(''),
    sameAs: z.array(z.string()).default([]),
    description_125: z.string().default(''),
    description_250: z.string().default(''),
    biography: z.string().default(''),
    // datePublished: z.string().transform(str => new Date(str)),
  }),
});

// category: Christianity,
// category_slug: christianity
// traffic: 29135
// image: image.png
// description: >-
//   Christianity is a monotheistic religion based on the life and teachings of
//   Jesus of Nazareth, as depicted in the New Testament of the Bible.
// topics:
//   theology:
//     topic: Theology


// collection: category:
const categories = defineCollection({
  type: 'data',
  schema: ({ image }) => z.object({
    category: z.string(),
    category_slug: z.string().default(''),
    traffic: z.number().default(0),
    image: z.object({
      src: image().refine((img) => img.width >= 400, {
        message: "Image must be at least 400 pixels wide!",
      }),
      alt: z.string(),
    }),
    description: z.string(),
    topics: z.record(z.object({
      topic: z.string(),
      description: z.string(),
    })),
  }),
});

// collection: topics:
const topics = defineCollection({
  type: 'data',
  schema: z.object({
    topic: z.string(),
    topic_slug: z.string(),
    category: z.string(),
    traffic: z.number().default(0),
    description: z.string(),
    subtopics: z.array(z.object({
      name: z.string(),
      slug: z.string(),
      description: z.string(),
    })),
  }),
});


// topic: Amaterasu Omikami
// topic_slug: amaterasu-omikami
// category: shinto
// description: >-
//   The sun goddess Amaterasu, considered the principal deity in Shinto,
//   symbolizes the importance of the sun for Japan. Her mythology and worship are
//   tied to the imperial lineage and are vital to understanding the spiritual
//   structure of Shinto.

// define collection for subtopics:
const subtopics = defineCollection({
  type: 'data',
  schema: z.object({
    topic: z.string(),
    topic_slug: z.string(),
    category: reference('categories'),
    subtopics: z.array(z.object({
      subtopic: z.string(),
      subtopic_slug: z.string(),
      keywords: z.array(z.string()),
      questions: z.array(z.string()),
   }))
  }),
});

// define collection for faqs:
const faqs = defineCollection({
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
      resources: z.array(reference('posts')).optional(),
    })),
  }),
});


// 3. Export a single `collections` object to register your collection(s)
//    This key should match your collection directory name in "src/content"
export const collections = { posts, team, categories, topics, subtopics, faqs, };


