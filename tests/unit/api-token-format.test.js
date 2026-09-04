// Pure content-API token + rate-limit helpers. No D1, no bindings.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ROLES, roleAtLeast, isWellFormed, tokenPrefix, newToken, sha256Hex,
  hashesMatch, isExpired, windowStart, bucketKey, pick, TOKEN_PREFIX, PREFIX_LEN,
} from '../../src/lib/api-token-format.js';

test('roleAtLeast', async (t) => {
  await t.test('a role satisfies itself', () => {
    for (const r of ROLES) assert.equal(roleAtLeast(r, r), true);
  });
  await t.test('higher roles satisfy lower requirements', () => {
    assert.equal(roleAtLeast('superadmin', 'author'), true);
    assert.equal(roleAtLeast('admin', 'editor'), true);
  });
  await t.test('lower roles do not satisfy higher requirements', () => {
    assert.equal(roleAtLeast('author', 'editor'), false);
    assert.equal(roleAtLeast('editor', 'admin'), false);
    assert.equal(roleAtLeast('admin', 'superadmin'), false);
  });
  await t.test('unknown roles never pass', () => {
    assert.equal(roleAtLeast('wizard', 'author'), false);
    assert.equal(roleAtLeast('admin', 'wizard'), false);
    assert.equal(roleAtLeast(undefined, 'author'), false);
  });
});

test('token shape', async (t) => {
  await t.test('minted tokens are well formed and unique', () => {
    const a = newToken();
    const b = newToken();
    assert.ok(isWellFormed(a));
    assert.ok(a.startsWith(TOKEN_PREFIX));
    assert.notEqual(a, b, 'two mints must not collide');
  });
  await t.test('prefix is the public lookup half', () => {
    const t1 = newToken();
    assert.equal(tokenPrefix(t1), t1.slice(TOKEN_PREFIX.length, TOKEN_PREFIX.length + PREFIX_LEN));
    assert.equal(tokenPrefix(t1).length, PREFIX_LEN);
  });
  await t.test('rejects junk', () => {
    for (const bad of ['', 'nope', 'drbi_', 'drbi_short', null, undefined, 42, {}]) {
      assert.equal(isWellFormed(bad), false, `should reject ${String(bad)}`);
      assert.equal(tokenPrefix(bad), null);
    }
  });
});

test('hashing', async (t) => {
  await t.test('sha256 is stable and 64 hex chars', async () => {
    const h = await sha256Hex('drbi');
    assert.match(h, /^[0-9a-f]{64}$/);
    assert.equal(h, await sha256Hex('drbi'));
  });
  await t.test('different tokens hash differently', async () => {
    assert.notEqual(await sha256Hex(newToken()), await sha256Hex(newToken()));
  });
  await t.test('the plaintext is not recoverable from the hash', async () => {
    const tok = newToken();
    const h = await sha256Hex(tok);
    assert.ok(!h.includes(tok.slice(TOKEN_PREFIX.length)));
  });
});

test('hashesMatch', async (t) => {
  await t.test('equal strings match', async () => {
    const h = await sha256Hex('x');
    assert.equal(hashesMatch(h, h), true);
  });
  await t.test('different or malformed values do not', async () => {
    const h = await sha256Hex('x');
    assert.equal(hashesMatch(h, await sha256Hex('y')), false);
    assert.equal(hashesMatch(h, h.slice(0, -1)), false, 'length mismatch must fail');
    assert.equal(hashesMatch('', ''), false, 'blank never matches blank');
    assert.equal(hashesMatch(null, h), false);
    assert.equal(hashesMatch(h, undefined), false);
  });
});

test('isExpired', async (t) => {
  const now = new Date('2026-09-04T00:00:00Z');
  await t.test('a live token is not expired', () => {
    assert.equal(isExpired({ expires_at: null, revoked_at: null }, now), false);
  });
  await t.test('a revoked token is dead even with a future expiry', () => {
    assert.equal(isExpired({ expires_at: '2099-01-01 00:00:00', revoked_at: '2026-01-01 00:00:00' }, now), true);
  });
  await t.test('past expiry is dead, future expiry is live', () => {
    assert.equal(isExpired({ expires_at: '2026-09-03 23:59:59', revoked_at: null }, now), true);
    assert.equal(isExpired({ expires_at: '2026-09-04 00:00:01', revoked_at: null }, now), false);
  });
  await t.test('bare D1 timestamps are read as UTC, not local time', () => {
    // Would flip if a bare stamp were parsed in a non-UTC local zone.
    assert.equal(isExpired({ expires_at: '2026-09-04 00:00:01' }, now), false);
  });
  await t.test('a missing row is treated as expired', () => {
    assert.equal(isExpired(null, now), true);
    assert.equal(isExpired(undefined, now), true);
  });
});

test('rate limit windows', async (t) => {
  await t.test('instants inside one window share a start', () => {
    const a = windowStart(Date.parse('2026-09-04T00:00:00Z'), 60);
    const b = windowStart(Date.parse('2026-09-04T00:00:59Z'), 60);
    assert.equal(a, b);
  });
  await t.test('crossing the boundary starts a new window', () => {
    const a = windowStart(Date.parse('2026-09-04T00:00:59Z'), 60);
    const b = windowStart(Date.parse('2026-09-04T00:01:00Z'), 60);
    assert.equal(b - a, 60);
  });
  await t.test('bucket keys are per token and per window', () => {
    assert.equal(bucketKey('tok', 120), 'tok:120');
    assert.notEqual(bucketKey('a', 60), bucketKey('b', 60));
  });
});

test('pick', async (t) => {
  await t.test('keeps only whitelisted fields', () => {
    assert.deepEqual(pick({ title: 'T', id: 'evil', extra: 1 }, ['title']), { title: 'T' });
  });
  await t.test('omits absent keys rather than setting undefined', () => {
    assert.deepEqual(pick({ title: 'T' }, ['title', 'body']), { title: 'T' });
    assert.equal('body' in pick({ title: 'T' }, ['title', 'body']), false);
  });
  await t.test('keeps falsy values that were explicitly sent', () => {
    assert.deepEqual(pick({ draft: false, n: 0, s: '' }, ['draft', 'n', 's']), { draft: false, n: 0, s: '' });
  });
  await t.test('tolerates junk bodies', () => {
    assert.deepEqual(pick(null, ['a']), {});
    assert.deepEqual(pick('nope', ['a']), {});
  });
});
