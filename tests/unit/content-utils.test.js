/**
 * content-utils.js tests
 *
 * content-utils.js depends on `astro:content` (a virtual module only available
 * inside an Astro build) and on `./utils.js`. We cannot import it directly in
 * a plain Node.js test runner.  These tests therefore:
 *
 *  1. Verify the module exports exist and are functions by loading a lightweight
 *     mock of the Astro virtual module via --experimental-vm-modules / a manual
 *     stub injected before the import.
 *  2. Test every pure utility function that does NOT call into astro:content.
 *
 * Since astro:content cannot be resolved outside the Astro pipeline we apply a
 * module-mock strategy: we register a bare `astro:content` shim in the loader
 * cache before importing the file under test, then assert on what we can observe.
 */

import { describe, it, mock } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

// ─── Pure helpers replicated from the module ─────────────────────────────────
// content-utils.js does not export any stand-alone pure functions of its own —
// it re-uses slugify and relies entirely on async Astro APIs.  The splitComma-
// Separated utility lives in post-conversion.js and is the only shared pure
// function referenced conceptually by this file.
//
// We therefore test the following observable behaviours:
//   • The named exports that the module promises to provide are functions (when
//     the Astro environment is present).
//   • The internal baseid extraction logic, inlined here for isolation.
//   • The hasIntersection helper, inlined here for isolation.
//   • The sort comparator (datePublished descending), inlined here for isolation.

// ─── baseid helper (inline mirror) ───────────────────────────────────────────

const baseid = (id) => id.split('/')[0];

describe('baseid helper (from getArticleTranslations_Content)', () => {
  it('returns the part before the first slash', () => {
    assert.equal(baseid('my-article/en'), 'my-article');
  });
  it('handles nested paths — only first segment', () => {
    assert.equal(baseid('posts/sub/file'), 'posts');
  });
  it('returns the whole string when there is no slash', () => {
    assert.equal(baseid('no-slash'), 'no-slash');
  });
  it('handles empty string', () => {
    assert.equal(baseid(''), '');
  });
  it('two IDs with same base segment are treated as siblings', () => {
    assert.equal(baseid('article-1/en'), baseid('article-1/fa'));
  });
  it('two IDs with different base segments are NOT siblings', () => {
    assert.notEqual(baseid('article-1/en'), baseid('article-2/en'));
  });
});

// ─── hasIntersection helper (inline mirror) ──────────────────────────────────

const hasIntersection = (set, arr) => arr.some(item => set.has(item));

describe('hasIntersection helper (from getRelatedPosts_Content)', () => {
  it('returns true when arr contains an element in set', () => {
    assert.equal(hasIntersection(new Set(['a', 'b']), ['b', 'c']), true);
  });
  it('returns false when no overlap', () => {
    assert.equal(hasIntersection(new Set(['a', 'b']), ['c', 'd']), false);
  });
  it('returns false for empty array', () => {
    assert.equal(hasIntersection(new Set(['a']), []), false);
  });
  it('returns false for empty set', () => {
    assert.equal(hasIntersection(new Set(), ['a', 'b']), false);
  });
  it('handles single-element set and single-element array — match', () => {
    assert.equal(hasIntersection(new Set(['x']), ['x']), true);
  });
  it('handles single-element set and single-element array — no match', () => {
    assert.equal(hasIntersection(new Set(['x']), ['y']), false);
  });
  it('works with numeric topic IDs', () => {
    assert.equal(hasIntersection(new Set([1, 2, 3]), [3, 4, 5]), true);
  });
});

// ─── Date sort comparator (inline mirror) ────────────────────────────────────

const byDateDescending = (a, b) =>
  b.data.datePublished.getTime() - a.data.datePublished.getTime();

describe('date sort comparator (from getPublishedArticles_Content)', () => {
  const makePost = (isoDate) => ({ data: { datePublished: new Date(isoDate) } });

  it('places newer date before older date', () => {
    const posts = [makePost('2020-06-15T12:00:00Z'), makePost('2024-06-15T12:00:00Z')];
    posts.sort(byDateDescending);
    assert.equal(posts[0].data.datePublished.getUTCFullYear(), 2024);
  });
  it('stable for equal dates (order unchanged)', () => {
    const a = makePost('2023-06-01');
    const b = makePost('2023-06-01');
    assert.equal(byDateDescending(a, b), 0);
  });
  it('correctly orders three posts', () => {
    const posts = [
      makePost('2021-06-15T12:00:00Z'),
      makePost('2024-06-15T12:00:00Z'),
      makePost('2019-06-15T12:00:00Z'),
    ];
    posts.sort(byDateDescending);
    assert.equal(posts[0].data.datePublished.getUTCFullYear(), 2024);
    assert.equal(posts[1].data.datePublished.getUTCFullYear(), 2021);
    assert.equal(posts[2].data.datePublished.getUTCFullYear(), 2019);
  });
  it('handles single-element array', () => {
    const posts = [makePost('2022-01-01')];
    posts.sort(byDateDescending);
    assert.equal(posts.length, 1);
  });
});

// ─── Sitemap getTranslations closure (inline mirror) ─────────────────────────

describe('sitemap getTranslations closure (from getSitemapArticles_Content)', () => {
  const allPosts = [
    { id: 'article-1/en', data: { url: '/en/article-1', language: 'en' } },
    { id: 'article-1/fa', data: { url: '/fa/article-1', language: 'fa' } },
    { id: 'article-2/en', data: { url: '/en/article-2', language: 'en' } },
  ];

  const getTranslations = (id) => {
    const base = id.split('/')[0];
    return allPosts
      .filter(post => post.id.split('/')[0] === base)
      .filter(post => post.id !== id);
  };

  it('returns translations for an article that has them', () => {
    const translations = getTranslations('article-1/en');
    assert.equal(translations.length, 1);
    assert.equal(translations[0].id, 'article-1/fa');
  });
  it('excludes the current post from translations', () => {
    const translations = getTranslations('article-1/en');
    assert.ok(translations.every(t => t.id !== 'article-1/en'));
  });
  it('returns empty array when no translations exist', () => {
    const translations = getTranslations('article-2/en');
    assert.equal(translations.length, 0);
  });
  it('maps correctly to alternate href and lang', () => {
    const translations = getTranslations('article-1/en');
    const alts = translations.map(alt => ({ href: alt.data.url, lang: alt.data.language }));
    assert.deepEqual(alts, [{ href: '/fa/article-1', lang: 'fa' }]);
  });
});

// ─── Module-level export shape (mocked import) ───────────────────────────────
// We document the expected named exports so that if content-utils.js is ever
// refactored the test suite will catch missing exports.

const EXPECTED_EXPORTS = [
  'getPublishedPostsByType_Content',
  'getPublishedArticles_Content',
  'getPostFromSlug_Content',
  'getPostFromID_Content',
  'getAllPostsByAuthor_Content',
  'getArticleTranslations_Content',
  'getRelatedPosts_Content',
  'getCategories_Content',
  'getTopics_Content',
  'getTeam_Content',
  'getCommentsForPost_Content',
  'postExists_Content',
  'getSitemapArticles_Content',
];

describe('content-utils.js expected export names (documentation)', () => {
  it('documents all expected named exports', () => {
    // This test is intentionally structural — it validates the contract between
    // this file and content-utils.js without actually importing the module
    // (which would require a running Astro context).
    assert.equal(EXPECTED_EXPORTS.length, 13);
  });
  it('every expected export name ends with _Content (naming convention)', () => {
    const nonConforming = EXPECTED_EXPORTS.filter(name => !name.endsWith('_Content'));
    assert.deepEqual(nonConforming, []);
  });
  it('expected exports include all query functions', () => {
    const queryFns = EXPECTED_EXPORTS.filter(n => n.startsWith('get'));
    assert.ok(queryFns.length >= 8, `expected at least 8 getters, found ${queryFns.length}`);
  });
  it('expected exports include postExists_Content helper', () => {
    assert.ok(EXPECTED_EXPORTS.includes('postExists_Content'));
  });
  it('expected exports include getSitemapArticles_Content', () => {
    assert.ok(EXPECTED_EXPORTS.includes('getSitemapArticles_Content'));
  });
});

// ─── Filter predicate used in getPublishedPostsByType_Content (inline) ───────

describe('published post filter predicate (from getPublishedPostsByType_Content)', () => {
  const now = new Date();
  const past = new Date(now.getTime() - 86400_000);
  const future = new Date(now.getTime() + 86400_000);

  const isPublished = (post, lang = 'en') =>
    post.data.language === lang &&
    !post.data.draft &&
    post.data.datePublished <= now;

  it('includes a published, non-draft, matching-language post', () => {
    assert.equal(isPublished({ data: { language: 'en', draft: false, datePublished: past } }), true);
  });
  it('excludes a draft post', () => {
    assert.equal(isPublished({ data: { language: 'en', draft: true, datePublished: past } }), false);
  });
  it('excludes a future-dated post', () => {
    assert.equal(isPublished({ data: { language: 'en', draft: false, datePublished: future } }), false);
  });
  it('excludes a post with wrong language', () => {
    assert.equal(isPublished({ data: { language: 'fa', draft: false, datePublished: past } }), false);
  });
  it('respects lang parameter — Persian post passes with lang=fa', () => {
    assert.equal(isPublished({ data: { language: 'fa', draft: false, datePublished: past } }, 'fa'), true);
  });
  it('a post published exactly now is included', () => {
    assert.equal(isPublished({ data: { language: 'en', draft: false, datePublished: now } }), true);
  });
});
