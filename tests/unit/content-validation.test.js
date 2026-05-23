/**
 * tests/unit/content-validation.test.js
 *
 * Tests for src/utils/content-validation.js.
 *
 * Exported surface:
 *   - ValidationError  (class)
 *   - quickValidate(postData)  (sync, returns error array)
 *   - validateContent(postData, fileContent, filePath)  (async, throws ValidationError)
 *
 * validateFrontmatter is an internal helper (not exported). Its behaviour is
 * exercised indirectly through validateContent with a well-formed fileContent
 * YAML frontmatter string.
 *
 * NOTE: validateContent also calls validateInternalLinks (checks filesystem)
 * and validateImageReferences. We set CMS_VALIDATE_STRICT=false in env before
 * importing so those side-effectful checks are skipped, leaving only the pure
 * frontmatter + markdown validation paths under test.
 */

import { describe, it, before } from 'node:test';
import assert from 'node:assert/strict';

// Disable strict-mode link/image filesystem checks for test isolation
process.env.CMS_VALIDATE_STRICT = 'false';
// Disable build check
process.env.CMS_BUILD_CHECK = 'false';

const { ValidationError, quickValidate, validateContent } = await import(
  '../../src/utils/content-validation.js'
);

// ─── ValidationError ─────────────────────────────────────────────────────────
describe('ValidationError', () => {
  it('is an instance of Error', () => {
    const err = new ValidationError(['one error']);
    assert.ok(err instanceof Error);
  });
  it('name property is "ValidationError"', () => {
    const err = new ValidationError(['e1']);
    assert.equal(err.name, 'ValidationError');
  });
  it('stores the errors array', () => {
    const errors = ['error one', 'error two'];
    const err = new ValidationError(errors);
    assert.deepEqual(err.errors, errors);
  });
  it('message includes the first error', () => {
    const err = new ValidationError(['something went wrong']);
    assert.ok(err.message.includes('something went wrong'));
  });
  it('message starts with "Validation failed:"', () => {
    const err = new ValidationError(['bad input']);
    assert.ok(err.message.startsWith('Validation failed:'));
  });
  it('errors array is empty-array safe', () => {
    const err = new ValidationError([]);
    assert.deepEqual(err.errors, []);
  });
  it('stack trace is present', () => {
    const err = new ValidationError(['e']);
    assert.ok(typeof err.stack === 'string');
  });
  it('multiple errors are all stored', () => {
    const errs = ['a', 'b', 'c'];
    const err = new ValidationError(errs);
    assert.equal(err.errors.length, 3);
  });
  it('message joins multiple errors with comma', () => {
    const err = new ValidationError(['err1', 'err2']);
    assert.ok(err.message.includes('err1'));
    assert.ok(err.message.includes('err2'));
  });
});

// ─── quickValidate ────────────────────────────────────────────────────────────
describe('quickValidate — title checks', () => {
  it('returns no errors for valid data', () => {
    const errors = quickValidate({ title: 'A Good Title', content: 'Some content here that is long enough.' });
    assert.equal(errors.length, 0);
  });
  it('returns error when title is missing', () => {
    const errors = quickValidate({ content: 'content here' });
    assert.ok(errors.some(e => e.toLowerCase().includes('title')));
  });
  it('returns error when title is empty string', () => {
    const errors = quickValidate({ title: '', content: 'content here' });
    assert.ok(errors.some(e => e.toLowerCase().includes('title')));
  });
  it('returns error when title is only whitespace', () => {
    const errors = quickValidate({ title: '   ', content: 'content here' });
    assert.ok(errors.some(e => e.toLowerCase().includes('title')));
  });
  it('returns error when title exceeds 60 characters', () => {
    const longTitle = 'A'.repeat(61);
    const errors = quickValidate({ title: longTitle, content: 'content here' });
    assert.ok(errors.some(e => e.toLowerCase().includes('title') || e.includes('60')));
  });
  it('does not error on a 60-character title (boundary)', () => {
    const title = 'A'.repeat(60);
    const errors = quickValidate({ title, content: 'Short content here that passes.' });
    const titleErrors = errors.filter(e => e.toLowerCase().includes('60'));
    assert.equal(titleErrors.length, 0);
  });
});

describe('quickValidate — content checks', () => {
  it('returns error when content is missing', () => {
    const errors = quickValidate({ title: 'Title' });
    assert.ok(errors.some(e => e.toLowerCase().includes('content')));
  });
  it('returns error when content is empty', () => {
    const errors = quickValidate({ title: 'Title', content: '' });
    assert.ok(errors.some(e => e.toLowerCase().includes('content')));
  });
  it('returns error when content is only whitespace', () => {
    const errors = quickValidate({ title: 'Title', content: '   ' });
    assert.ok(errors.some(e => e.toLowerCase().includes('content')));
  });
  it('returns empty array for good title and content', () => {
    const errors = quickValidate({ title: 'Valid Title', content: 'This is some valid content.' });
    assert.equal(errors.length, 0);
  });
  it('returns an array (never throws)', () => {
    const result = quickValidate({});
    assert.ok(Array.isArray(result));
  });
});

describe('quickValidate — markdown parsing', () => {
  it('does not add error for valid markdown', () => {
    const errors = quickValidate({
      title: 'Title',
      content: '## Heading\n\nThis is a paragraph.',
    });
    assert.equal(errors.length, 0);
  });
  it('handles bold, italic, links in content without errors', () => {
    const errors = quickValidate({
      title: 'Title',
      content: '**bold** _italic_ [link](https://example.com)',
    });
    assert.equal(errors.length, 0);
  });
});

// ─── validateContent (async) ──────────────────────────────────────────────────

// Helper to build a minimal valid YAML frontmatter + content string
const makeFileContent = (overrides = {}, bodyOverride = null) => {
  const fm = {
    title: 'My Valid Title',
    language: 'en',
    datePublished: '2024-01-01',
    url: '/my-valid-title',
    description: 'A description for this article.',
    ...overrides,
  };
  const fmLines = Object.entries(fm).filter(([, v]) => v !== undefined).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n');
  const body = bodyOverride ?? 'This is the body content of the article. It is long enough to pass all of the content validation checks including the minimum length requirement that requires at least one hundred characters.';
  return `---\n${fmLines}\n---\n\n${body}`;
};

describe('validateContent — valid content', () => {
  it('resolves without throwing for completely valid content', async () => {
    const fileContent = makeFileContent();
    await assert.doesNotReject(
      validateContent({ type: 'article' }, fileContent)
    );
  });
  it('resolves for memorial type with description', async () => {
    const fileContent = makeFileContent({ description: 'A memorial description.' });
    await assert.doesNotReject(
      validateContent({ type: 'memorial' }, fileContent)
    );
  });
  it('resolves for news type with abstract', async () => {
    const fileContent = makeFileContent({ abstract: 'This is the abstract.' });
    await assert.doesNotReject(
      validateContent({ type: 'news' }, fileContent)
    );
  });
});

describe('validateContent — frontmatter errors', () => {
  it('throws ValidationError when title is missing', async () => {
    const fileContent = makeFileContent({ title: undefined });
    await assert.rejects(
      validateContent({ type: 'article' }, fileContent),
      (err) => err instanceof ValidationError
    );
  });
  it('thrown ValidationError contains title error', async () => {
    const fileContent = makeFileContent({ title: '' });
    let caught;
    try {
      await validateContent({ type: 'article' }, fileContent);
    } catch (e) {
      caught = e;
    }
    assert.ok(caught instanceof ValidationError);
    assert.ok(caught.errors.some(e => e.toLowerCase().includes('title')));
  });
  it('throws when language is missing', async () => {
    const fileContent = makeFileContent({ language: undefined });
    await assert.rejects(
      validateContent({ type: 'article' }, fileContent),
      (err) => err instanceof ValidationError
    );
  });
  it('throws when datePublished is missing', async () => {
    const fileContent = makeFileContent({ datePublished: undefined });
    await assert.rejects(
      validateContent({ type: 'article' }, fileContent),
      (err) => err instanceof ValidationError
    );
  });
  it('throws when url is missing', async () => {
    const fileContent = makeFileContent({ url: undefined });
    await assert.rejects(
      validateContent({ type: 'article' }, fileContent),
      (err) => err instanceof ValidationError
    );
  });
  it('throws when url does not start with /', async () => {
    const fileContent = makeFileContent({ url: 'no-leading-slash' });
    await assert.rejects(
      validateContent({ type: 'article' }, fileContent),
      (err) => err instanceof ValidationError
    );
  });
  it('errors include URL validation message', async () => {
    const fileContent = makeFileContent({ url: 'no-leading-slash' });
    let caught;
    try { await validateContent({ type: 'article' }, fileContent); } catch (e) { caught = e; }
    assert.ok(caught.errors.some(e => e.toLowerCase().includes('url')));
  });
  it('throws when title exceeds 60 chars', async () => {
    const fileContent = makeFileContent({ title: 'A'.repeat(61) });
    await assert.rejects(
      validateContent({ type: 'article' }, fileContent),
      (err) => err instanceof ValidationError
    );
  });
  it('throws for article type missing both description and abstract', async () => {
    const fileContent = makeFileContent({ description: undefined, abstract: undefined });
    await assert.rejects(
      validateContent({ type: 'article' }, fileContent),
      (err) => err instanceof ValidationError
    );
  });
});

describe('validateContent — markdown body errors', () => {
  it('throws when body is empty', async () => {
    const fileContent = makeFileContent({}, '');
    await assert.rejects(
      validateContent({ type: 'article' }, fileContent),
      (err) => err instanceof ValidationError
    );
  });
  it('throws when content is too short (under 100 chars)', async () => {
    const fileContent = makeFileContent({}, 'Short.');
    await assert.rejects(
      validateContent({ type: 'article' }, fileContent),
      (err) => err instanceof ValidationError
    );
  });
  it('throws when a link has empty text', async () => {
    const body = 'A'.repeat(100) + '\n[](https://example.com)';
    const fileContent = makeFileContent({}, body);
    await assert.rejects(
      validateContent({ type: 'article' }, fileContent),
      (err) => err instanceof ValidationError
    );
  });
  it('throws when an image has empty alt text', async () => {
    const body = 'A'.repeat(100) + '\n![](https://example.com/img.jpg)';
    const fileContent = makeFileContent({}, body);
    await assert.rejects(
      validateContent({ type: 'article' }, fileContent),
      (err) => err instanceof ValidationError
    );
  });
});
