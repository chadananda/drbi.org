import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SESSION_DAYS, sessionExpiry, needsRenewal } from '../../src/lib/session-policy.js';

const DAY = 864e5;
const now = Date.UTC(2026, 10, 1);

test('sessions last 400 days', () => {
  assert.equal(SESSION_DAYS, 400);
  assert.equal(sessionExpiry(now).getTime(), now + 400 * DAY);
});

test('fresh token is not renewed', () => {
  assert.equal(needsRenewal(sessionExpiry(now), now + 3600e3), false);
});

test('token older than a day is renewed', () => {
  assert.equal(needsRenewal(sessionExpiry(now), now + 2 * DAY), true);
});

test('legacy 7-day token is renewed', () => {
  assert.equal(needsRenewal(new Date(now + 6 * DAY), now), true);
});
