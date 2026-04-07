import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';
import {
  generateCmsId,
  generateMarkdownFilename,
  generateCmsFilePath,
  generateUrlSlug,
  extractPostType,
  convertTimestamp,
  splitCommaSeparated,
  validateDbPost,
} from '../../src/utils/post-conversion.js';

// ─── Shared fixtures ──────────────────────────────────────────────────────────

const articlePost  = { title: 'My Great Article',    category: 'Articles',     body: 'x'.repeat(60) };
const memorialPost = { title: 'John Doe Memorial',   category: 'Memorials',    body: 'x'.repeat(60) };
const newsPost     = { title: 'Latest News Update',  category: 'News Items',   body: 'x'.repeat(60) };

// ─── generateCmsId ────────────────────────────────────────────────────────────

describe('generateCmsId', () => {
  it('returns "articles/slug" for an article post', () => {
    assert.equal(generateCmsId(articlePost), 'articles/my-great-article');
  });
  it('returns "memorial/slug" when category includes memorial', () => {
    assert.equal(generateCmsId(memorialPost), 'memorial/john-doe-memorial');
  });
  it('returns "news/slug" when category includes news', () => {
    assert.equal(generateCmsId(newsPost), 'news/latest-news-update');
  });
  it('slugifies title — replaces spaces with dashes', () => {
    const post = { title: 'Hello World Test', category: '' };
    assert.match(generateCmsId(post), /hello-world-test/);
  });
  it('slugifies title — lowercases', () => {
    const post = { title: 'ALL CAPS TITLE', category: '' };
    assert.match(generateCmsId(post), /all-caps-title/);
  });
  it('removes special characters from slug', () => {
    const post = { title: 'Title (with) special! chars', category: '' };
    const result = generateCmsId(post);
    assert.ok(!result.includes('(') && !result.includes(')') && !result.includes('!'));
  });
  it('defaults to articles when category is undefined', () => {
    const post = { title: 'Something', category: undefined };
    assert.match(generateCmsId(post), /^articles\//);
  });
  it('defaults to articles when category is empty string', () => {
    const post = { title: 'Something', category: '' };
    assert.match(generateCmsId(post), /^articles\//);
  });
  it('is case-insensitive on category matching', () => {
    assert.match(generateCmsId({ title: 'Test', category: 'MEMORIAL' }), /^memorial\//);
    assert.match(generateCmsId({ title: 'Test', category: 'NEWS' }), /^news\//);
  });
  it('format is always "type/slug" with exactly one slash', () => {
    const id = generateCmsId(articlePost);
    assert.equal(id.split('/').length, 2);
  });
});

// ─── generateMarkdownFilename ────────────────────────────────────────────────

describe('generateMarkdownFilename', () => {
  it('appends .md extension', () => {
    assert.ok(generateMarkdownFilename(articlePost).endsWith('.md'));
  });
  it('slugifies the title', () => {
    assert.equal(generateMarkdownFilename(articlePost), 'my-great-article.md');
  });
  it('lowercases all characters', () => {
    const post = { title: 'UPPER CASE' };
    assert.equal(generateMarkdownFilename(post), 'upper-case.md');
  });
  it('removes special chars', () => {
    const post = { title: 'Hello (World)!' };
    const result = generateMarkdownFilename(post);
    assert.ok(!result.includes('(') && !result.includes(')') && !result.includes('!'));
  });
  it('replaces spaces with hyphens', () => {
    const post = { title: 'a b c' };
    assert.equal(generateMarkdownFilename(post), 'a-b-c.md');
  });
  it('handles single-word title', () => {
    assert.equal(generateMarkdownFilename({ title: 'Simple' }), 'simple.md');
  });
  it('handles title with numbers', () => {
    assert.equal(generateMarkdownFilename({ title: 'Year 2024 Report' }), 'year-2024-report.md');
  });
  it('does not include category in output', () => {
    assert.equal(generateMarkdownFilename(memorialPost), 'john-doe-memorial.md');
  });
  it('strips apostrophes and quotes', () => {
    const post = { title: "Author's Guide" };
    const result = generateMarkdownFilename(post);
    assert.ok(!result.includes("'"), `should not contain apostrophe: ${result}`);
  });
});

// ─── generateCmsFilePath ─────────────────────────────────────────────────────

describe('generateCmsFilePath', () => {
  it('starts with src/content/', () => {
    assert.ok(generateCmsFilePath(articlePost).startsWith('src/content/'));
  });
  it('includes correct post type directory for article', () => {
    assert.match(generateCmsFilePath(articlePost), /src\/content\/articles\//);
  });
  it('includes correct post type directory for memorial', () => {
    assert.match(generateCmsFilePath(memorialPost), /src\/content\/memorial\//);
  });
  it('includes correct post type directory for news', () => {
    assert.match(generateCmsFilePath(newsPost), /src\/content\/news\//);
  });
  it('ends with .md', () => {
    assert.ok(generateCmsFilePath(articlePost).endsWith('.md'));
  });
  it('full path is correct for article', () => {
    assert.equal(generateCmsFilePath(articlePost), 'src/content/articles/my-great-article.md');
  });
  it('full path is correct for memorial', () => {
    assert.equal(generateCmsFilePath(memorialPost), 'src/content/memorial/john-doe-memorial.md');
  });
  it('full path is correct for news', () => {
    assert.equal(generateCmsFilePath(newsPost), 'src/content/news/latest-news-update.md');
  });
  it('defaults to articles when no category', () => {
    const post = { title: 'No Category Post' };
    assert.match(generateCmsFilePath(post), /src\/content\/articles\//);
  });
  it('path has exactly 4 segments separated by /', () => {
    const parts = generateCmsFilePath(articlePost).split('/');
    assert.equal(parts.length, 4);
  });
});

// ─── generateUrlSlug ─────────────────────────────────────────────────────────

describe('generateUrlSlug', () => {
  it('starts with /', () => {
    assert.ok(generateUrlSlug(articlePost).startsWith('/'));
  });
  it('includes post type segment for article', () => {
    assert.match(generateUrlSlug(articlePost), /^\/articles\//);
  });
  it('includes post type segment for memorial', () => {
    assert.match(generateUrlSlug(memorialPost), /^\/memorial\//);
  });
  it('includes post type segment for news', () => {
    assert.match(generateUrlSlug(newsPost), /^\/news\//);
  });
  it('full URL is correct for article', () => {
    assert.equal(generateUrlSlug(articlePost), '/articles/my-great-article');
  });
  it('full URL is correct for memorial', () => {
    assert.equal(generateUrlSlug(memorialPost), '/memorial/john-doe-memorial');
  });
  it('does not end with .md', () => {
    assert.ok(!generateUrlSlug(articlePost).endsWith('.md'));
  });
  it('slugifies and lowercases title', () => {
    const post = { title: 'HELLO World', category: '' };
    assert.match(generateUrlSlug(post), /hello-world/);
  });
  it('defaults to /articles/ when category is undefined', () => {
    const post = { title: 'Test', category: undefined };
    assert.match(generateUrlSlug(post), /^\/articles\//);
  });
  it('has exactly two path segments after the leading slash', () => {
    const url = generateUrlSlug(articlePost);
    const parts = url.slice(1).split('/');
    assert.equal(parts.length, 2);
  });
});

// ─── extractPostType ─────────────────────────────────────────────────────────

describe('extractPostType', () => {
  it('returns "memorial" when category includes memorial', () => {
    assert.equal(extractPostType({ category: 'Memorials' }), 'memorial');
  });
  it('returns "news" when category includes news', () => {
    assert.equal(extractPostType({ category: 'News Items' }), 'news');
  });
  it('returns "article" for generic category', () => {
    assert.equal(extractPostType({ category: 'Articles' }), 'article');
  });
  it('returns "memorial" when type field is memorial (fallback)', () => {
    assert.equal(extractPostType({ type: 'memorial' }), 'memorial');
  });
  it('returns "news" when type field is news (fallback)', () => {
    assert.equal(extractPostType({ type: 'news' }), 'news');
  });
  it('returns "memorial" when title includes memorial (fallback)', () => {
    assert.equal(extractPostType({ title: 'John Doe Memorial Service' }), 'memorial');
  });
  it('category takes precedence over type field', () => {
    assert.equal(extractPostType({ category: 'News', type: 'memorial' }), 'news');
  });
  it('category takes precedence over title', () => {
    assert.equal(extractPostType({ category: 'News', title: 'Memorial Service' }), 'news');
  });
  it('returns "article" as default when no signals found', () => {
    assert.equal(extractPostType({ title: 'Some Post', category: 'Generic' }), 'article');
  });
  it('is case-insensitive on category', () => {
    assert.equal(extractPostType({ category: 'MEMORIAL' }), 'memorial');
    assert.equal(extractPostType({ category: 'NEWS' }), 'news');
  });
  it('returns "article" when all fields are undefined', () => {
    assert.equal(extractPostType({}), 'article');
  });
  it('is case-insensitive on type field', () => {
    assert.equal(extractPostType({ type: 'MEMORIAL' }), 'memorial');
  });
});

// ─── convertTimestamp ────────────────────────────────────────────────────────

describe('convertTimestamp', () => {
  it('converts ISO date string to ISO string', () => {
    const result = convertTimestamp('2024-01-15T10:30:00Z');
    assert.equal(result, new Date('2024-01-15T10:30:00Z').toISOString());
  });
  it('converts date-only string', () => {
    const result = convertTimestamp('2024-01-15');
    assert.ok(result.startsWith('2024-01-15'));
  });
  it('converts Date object', () => {
    const date = new Date('2024-06-01');
    assert.equal(convertTimestamp(date), date.toISOString());
  });
  it('converts numeric timestamp (milliseconds)', () => {
    const ms = 1700000000000;
    assert.equal(convertTimestamp(ms), new Date(ms).toISOString());
  });
  it('returns current ISO string when passed null', () => {
    const before = Date.now();
    const result = convertTimestamp(null);
    const after = Date.now();
    const ts = new Date(result).getTime();
    assert.ok(ts >= before && ts <= after, 'should be close to now');
  });
  it('returns current ISO string when passed undefined', () => {
    const result = convertTimestamp(undefined);
    assert.ok(!isNaN(new Date(result).getTime()));
  });
  it('returns current ISO string for invalid date string', () => {
    const result = convertTimestamp('not-a-date');
    // NaN date — should not throw, should return a valid ISO string
    assert.equal(typeof result, 'string');
  });
  it('output is always a valid ISO string format', () => {
    const result = convertTimestamp('2024-03-20T12:00:00.000Z');
    assert.match(result, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
  });
  it('handles empty string like null', () => {
    const result = convertTimestamp('');
    assert.equal(typeof result, 'string');
    assert.ok(!isNaN(new Date(result).getTime()));
  });
  it('preserves timezone info — output is UTC', () => {
    const result = convertTimestamp('2024-07-04T00:00:00Z');
    assert.ok(result.endsWith('Z'));
  });
});

// ─── splitCommaSeparated ──────────────────────────────────────────────────────

describe('splitCommaSeparated', () => {
  it('splits simple comma-separated string', () => {
    assert.deepEqual(splitCommaSeparated('a, b, c'), ['a', 'b', 'c']);
  });
  it('trims whitespace from each item', () => {
    assert.deepEqual(splitCommaSeparated('  foo  ,  bar  '), ['foo', 'bar']);
  });
  it('returns empty array for null', () => {
    assert.deepEqual(splitCommaSeparated(null), []);
  });
  it('returns empty array for undefined', () => {
    assert.deepEqual(splitCommaSeparated(undefined), []);
  });
  it('returns empty array for empty string', () => {
    assert.deepEqual(splitCommaSeparated(''), []);
  });
  it('returns empty array for non-string input (number)', () => {
    assert.deepEqual(splitCommaSeparated(42), []);
  });
  it('returns empty array for non-string input (object)', () => {
    assert.deepEqual(splitCommaSeparated({}), []);
  });
  it('returns single-element array when no commas', () => {
    assert.deepEqual(splitCommaSeparated('single'), ['single']);
  });
  it('filters out empty entries from trailing commas', () => {
    const result = splitCommaSeparated('a, b, ');
    assert.ok(!result.includes(''), 'should not contain empty strings');
  });
  it('filters out entries that are only whitespace', () => {
    const result = splitCommaSeparated('a,   ,b');
    assert.ok(!result.includes(''));
    assert.ok(!result.includes('   '));
  });
  it('handles many items', () => {
    const input = Array.from({ length: 10 }, (_, i) => `item${i}`).join(', ');
    assert.equal(splitCommaSeparated(input).length, 10);
  });
  it('preserves internal spaces in items', () => {
    assert.deepEqual(splitCommaSeparated('New York, Los Angeles'), ['New York', 'Los Angeles']);
  });
});

// ─── validateDbPost ───────────────────────────────────────────────────────────

describe('validateDbPost', () => {
  const goodContent = 'x'.repeat(60);

  it('returns valid:true for a well-formed post', () => {
    const result = validateDbPost({ title: 'Good Title', body: goodContent });
    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });
  it('returns valid:false when title is missing', () => {
    const result = validateDbPost({ body: goodContent });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => /title/i.test(e)));
  });
  it('returns valid:false when title is empty string', () => {
    const result = validateDbPost({ title: '', body: goodContent });
    assert.equal(result.valid, false);
  });
  it('returns valid:false when title is only whitespace', () => {
    const result = validateDbPost({ title: '   ', body: goodContent });
    assert.equal(result.valid, false);
  });
  it('returns valid:false when both body and content are absent', () => {
    const result = validateDbPost({ title: 'Title' });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => /content|body/i.test(e)));
  });
  it('accepts content field as alternative to body', () => {
    const result = validateDbPost({ title: 'Title', content: goodContent });
    assert.equal(result.valid, true);
  });
  it('returns error when title exceeds 100 characters', () => {
    const result = validateDbPost({ title: 'T'.repeat(101), body: goodContent });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => /too long|100/i.test(e)));
  });
  it('allows title of exactly 100 characters', () => {
    const result = validateDbPost({ title: 'T'.repeat(100), body: goodContent });
    const titleErrors = result.errors.filter(e => /too long/i.test(e));
    assert.equal(titleErrors.length, 0);
  });
  it('returns error when content is shorter than 50 characters', () => {
    const result = validateDbPost({ title: 'Title', body: 'short' });
    assert.equal(result.valid, false);
    assert.ok(result.errors.some(e => /too short|50/i.test(e)));
  });
  it('allows content of exactly 50 characters', () => {
    const result = validateDbPost({ title: 'Title', body: 'x'.repeat(50) });
    const shortErrors = result.errors.filter(e => /too short/i.test(e));
    assert.equal(shortErrors.length, 0);
  });
  it('accumulates multiple errors', () => {
    const result = validateDbPost({});
    assert.ok(result.errors.length >= 2, 'should report missing title and missing content');
  });
  it('returns object with valid and errors properties', () => {
    const result = validateDbPost({ title: 'T', body: goodContent });
    assert.ok('valid' in result);
    assert.ok('errors' in result);
    assert.ok(Array.isArray(result.errors));
  });
  it('prefers body over content when computing length check', () => {
    // body is present and long enough — should be valid
    const result = validateDbPost({ title: 'Title', body: goodContent, content: 'short' });
    assert.equal(result.valid, true);
  });
});
