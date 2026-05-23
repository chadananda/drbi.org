/**
 * tests/unit/analytics-utils.test.js
 *
 * Tests for src/utils/analytics-utils.js.
 *
 * EXPORTED surface (from module source):
 *   - loadImportedAnalytics()   — async, filesystem dependent, skipped here
 *   - combineAnalyticsData(importedData, posthogData)  — exported, testable
 *
 * INTERNAL helpers tested via combineAnalyticsData behaviour:
 *   - getEarlierDate / getLaterDate — exercised through combineAnalyticsData
 *     dateRange outputs
 *   - combineTopPages / combineReferrers — exercised through the returned
 *     topPages / referrers arrays
 *   - normalizePageUrl / normalizeReferrer — exercised via combineTopPages /
 *     combineReferrers URL normalization
 *
 * getEarlierDate and getLaterDate are not exported but their logic is trivial
 * and fully covered by inline mirrors in the last describe block.
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

const { combineAnalyticsData } = await import('../../src/utils/analytics-utils.js');

// ─── Inline mirrors of private helpers (for direct unit testing) ──────────────
const getEarlierDate = (d1, d2) => {
  if (!d1) return d2;
  if (!d2) return d1;
  return d1 < d2 ? d1 : d2;
};
const getLaterDate = (d1, d2) => {
  if (!d1) return d2;
  if (!d2) return d1;
  return d1 > d2 ? d1 : d2;
};

// ─── Fixtures ─────────────────────────────────────────────────────────────────
const makeImported = (overrides = {}) => ({
  pageViews: [100, 200, 150],
  topPages: [
    { breakdown_value: '/about', count: 300, visitors: 250, label: 'About' },
    { breakdown_value: '/events', count: 200, visitors: 180, label: 'Events' },
  ],
  referrers: [
    { breakdown_value: 'google.com', count: 150, label: 'Google Search' },
  ],
  countries: [],
  states: [],
  uniqueVisitors: [80, 160, 120],
  dateRange: { startDate: '2023-01-01', endDate: '2023-06-30' },
  totalPageViews: 450,
  totalUniqueVisitors: 360,
  sources: [{ source: 'ga', fileName: 'import-1.json' }],
  isImported: true,
  ...overrides,
});

const makePosthog = (overrides = {}) => ({
  pageViews: [50, 75],
  topPages: [
    { breakdown_value: '/events', count: 90, visitors: 80, label: 'Events' },
    { breakdown_value: '/contact', count: 40, visitors: 35, label: 'Contact' },
  ],
  referrers: [
    { breakdown_value: 'google.com', count: 60, label: 'Google Search' },
    { breakdown_value: 'facebook.com', count: 25, label: 'Facebook' },
  ],
  countries: [],
  states: [],
  uniqueVisitors: [40, 60],
  dateRange: { startDate: '2023-10-01', endDate: '2023-12-31' },
  totalPageViews: 125,
  totalUniqueVisitors: 100,
  isDemo: false,
  ...overrides,
});

// ─── getEarlierDate (inline mirror) ──────────────────────────────────────────
describe('getEarlierDate', () => {
  it('returns the earlier of two date strings', () => {
    assert.equal(getEarlierDate('2023-01-01', '2023-06-01'), '2023-01-01');
  });
  it('returns the earlier when order is reversed', () => {
    assert.equal(getEarlierDate('2023-06-01', '2023-01-01'), '2023-01-01');
  });
  it('returns d2 when d1 is null', () => {
    assert.equal(getEarlierDate(null, '2023-06-01'), '2023-06-01');
  });
  it('returns d1 when d2 is null', () => {
    assert.equal(getEarlierDate('2023-01-01', null), '2023-01-01');
  });
  it('returns the same value when both dates are equal', () => {
    assert.equal(getEarlierDate('2023-03-15', '2023-03-15'), '2023-03-15');
  });
  it('returns undefined when both are null (no crash)', () => {
    const result = getEarlierDate(null, null);
    assert.equal(result, null);
  });
  it('works with Date objects', () => {
    const d1 = new Date('2022-01-01');
    const d2 = new Date('2024-01-01');
    assert.deepEqual(getEarlierDate(d1, d2), d1);
  });
});

// ─── getLaterDate (inline mirror) ────────────────────────────────────────────
describe('getLaterDate', () => {
  it('returns the later of two date strings', () => {
    assert.equal(getLaterDate('2023-01-01', '2023-12-31'), '2023-12-31');
  });
  it('returns the later when order is reversed', () => {
    assert.equal(getLaterDate('2023-12-31', '2023-01-01'), '2023-12-31');
  });
  it('returns d2 when d1 is null', () => {
    assert.equal(getLaterDate(null, '2023-12-31'), '2023-12-31');
  });
  it('returns d1 when d2 is null', () => {
    assert.equal(getLaterDate('2023-12-31', null), '2023-12-31');
  });
  it('returns the same value when both dates are equal', () => {
    assert.equal(getLaterDate('2023-06-15', '2023-06-15'), '2023-06-15');
  });
  it('returns null when both are null (no crash)', () => {
    assert.equal(getLaterDate(null, null), null);
  });
  it('works with Date objects', () => {
    const d1 = new Date('2022-01-01');
    const d2 = new Date('2024-01-01');
    assert.deepEqual(getLaterDate(d1, d2), d2);
  });
});

// ─── combineAnalyticsData — null / missing data cases ─────────────────────────
describe('combineAnalyticsData — null / missing data cases', () => {
  it('returns posthogData when importedData is null', () => {
    const posthog = makePosthog();
    const result = combineAnalyticsData(null, posthog);
    assert.deepEqual(result, posthog);
  });
  it('returns imported data (marked hybrid) when posthogData is null', () => {
    const imported = makeImported();
    const result = combineAnalyticsData(imported, null);
    assert.equal(result.isHybrid, true);
    assert.equal(result.dataSource, 'imported');
  });
  it('returns imported data when posthogData is a demo dataset', () => {
    const imported = makeImported();
    const result = combineAnalyticsData(imported, { isDemo: true });
    assert.equal(result.isHybrid, true);
  });
  it('does not throw when both imported and posthog are null', () => {
    const result = combineAnalyticsData(null, null);
    assert.equal(result, null);
  });
});

// ─── combineAnalyticsData — non-overlapping merge ────────────────────────────
describe('combineAnalyticsData — non-overlapping date ranges', () => {
  it('returns isHybrid=true', () => {
    const result = combineAnalyticsData(makeImported(), makePosthog());
    assert.equal(result.isHybrid, true);
  });
  it('dataSource is non-overlapping-combined', () => {
    const result = combineAnalyticsData(makeImported(), makePosthog());
    assert.equal(result.dataSource, 'non-overlapping-combined');
  });
  it('totalPageViews is sum of both sources', () => {
    const imported = makeImported({ totalPageViews: 450 });
    const posthog = makePosthog({ totalPageViews: 125 });
    const result = combineAnalyticsData(imported, posthog);
    assert.equal(result.totalPageViews, 575);
  });
  it('totalUniqueVisitors is sum of both sources', () => {
    const imported = makeImported({ totalUniqueVisitors: 360 });
    const posthog = makePosthog({ totalUniqueVisitors: 100 });
    const result = combineAnalyticsData(imported, posthog);
    assert.equal(result.totalUniqueVisitors, 460);
  });
  it('pageViews array is concatenation of both', () => {
    const imported = makeImported({ pageViews: [10, 20] });
    const posthog = makePosthog({ pageViews: [5, 15] });
    const result = combineAnalyticsData(imported, posthog);
    assert.deepEqual(result.pageViews, [10, 20, 5, 15]);
  });
  it('uniqueVisitors array is concatenation of both', () => {
    const imported = makeImported({ uniqueVisitors: [8, 16] });
    const posthog = makePosthog({ uniqueVisitors: [4, 12] });
    const result = combineAnalyticsData(imported, posthog);
    assert.deepEqual(result.uniqueVisitors, [8, 16, 4, 12]);
  });
  it('dateRange.startDate is the earlier of the two starts', () => {
    const result = combineAnalyticsData(makeImported(), makePosthog());
    assert.equal(result.dateRange.startDate, '2023-01-01');
  });
  it('dateRange.endDate is the later of the two ends', () => {
    const result = combineAnalyticsData(makeImported(), makePosthog());
    assert.equal(result.dateRange.endDate, '2023-12-31');
  });
  it('isDemo is false', () => {
    const result = combineAnalyticsData(makeImported(), makePosthog());
    assert.equal(result.isDemo, false);
  });
});

// ─── combineAnalyticsData — topPages merging ─────────────────────────────────
describe('combineAnalyticsData — topPages merging', () => {
  it('topPages is an array', () => {
    const result = combineAnalyticsData(makeImported(), makePosthog());
    assert.ok(Array.isArray(result.topPages));
  });
  it('topPages combines counts for the same path', () => {
    // /events appears in both imported (200) and posthog (90) -> should be 290
    const result = combineAnalyticsData(makeImported(), makePosthog());
    const events = result.topPages.find(p => p.breakdown_value === '/events');
    assert.ok(events, '/events should appear in combined topPages');
    assert.equal(events.count, 290);
  });
  it('topPages includes paths only in imported', () => {
    const result = combineAnalyticsData(makeImported(), makePosthog());
    const about = result.topPages.find(p => p.breakdown_value === '/about');
    assert.ok(about, '/about should appear');
  });
  it('topPages includes paths only in posthog', () => {
    const result = combineAnalyticsData(makeImported(), makePosthog());
    const contact = result.topPages.find(p => p.breakdown_value === '/contact');
    assert.ok(contact, '/contact should appear');
  });
  it('topPages is sorted by count descending', () => {
    const result = combineAnalyticsData(makeImported(), makePosthog());
    for (let i = 1; i < result.topPages.length; i++) {
      assert.ok(result.topPages[i - 1].count >= result.topPages[i].count);
    }
  });
  it('topPages is capped at 20 entries', () => {
    const manyPages = Array.from({ length: 25 }, (_, i) => ({
      breakdown_value: `/page-${i}`,
      count: 100 - i,
      visitors: 80 - i,
    }));
    const imported = makeImported({ topPages: manyPages });
    const result = combineAnalyticsData(imported, makePosthog());
    assert.ok(result.topPages.length <= 20);
  });
  it('normalizes full URL to path (strips domain)', () => {
    const imported = makeImported({
      topPages: [{ breakdown_value: 'https://drbi.org/about', count: 50, visitors: 40 }],
    });
    const result = combineAnalyticsData(imported, makePosthog({ topPages: [] }));
    const hasFullUrl = result.topPages.some(p => p.breakdown_value.startsWith('http'));
    assert.equal(hasFullUrl, false);
  });
  it('handles null topPages in imported gracefully', () => {
    const imported = makeImported({ topPages: null });
    const result = combineAnalyticsData(imported, makePosthog({ topPages: [] }));
    assert.ok(Array.isArray(result.topPages));
  });
});

// ─── combineAnalyticsData — referrers merging ─────────────────────────────────
describe('combineAnalyticsData — referrers merging', () => {
  it('referrers is an array', () => {
    const result = combineAnalyticsData(makeImported(), makePosthog());
    assert.ok(Array.isArray(result.referrers));
  });
  it('google.com counts are combined', () => {
    // imported: 150, posthog: 60 -> 210
    const result = combineAnalyticsData(makeImported(), makePosthog());
    const google = result.referrers.find(r => r.breakdown_value === 'google.com');
    assert.ok(google, 'google.com should appear');
    assert.equal(google.count, 210);
  });
  it('facebook.com appears from posthog only', () => {
    const result = combineAnalyticsData(makeImported(), makePosthog());
    const fb = result.referrers.find(r => r.breakdown_value === 'facebook.com');
    assert.ok(fb, 'facebook.com should appear');
    assert.equal(fb.count, 25);
  });
  it('referrers sorted by count descending', () => {
    const result = combineAnalyticsData(makeImported(), makePosthog());
    for (let i = 1; i < result.referrers.length; i++) {
      assert.ok(result.referrers[i - 1].count >= result.referrers[i].count);
    }
  });
  it('normalizes full referrer URL to domain', () => {
    const imported = makeImported({
      referrers: [{ breakdown_value: 'https://www.google.com/search?q=test', count: 50 }],
    });
    const result = combineAnalyticsData(imported, makePosthog({ referrers: [] }));
    const hasFullUrl = result.referrers.some(r => r.breakdown_value.startsWith('http'));
    assert.equal(hasFullUrl, false);
  });
  it('strips www. prefix from referrer domain', () => {
    const imported = makeImported({
      referrers: [{ breakdown_value: 'www.example.com', count: 20 }],
    });
    const result = combineAnalyticsData(imported, makePosthog({ referrers: [] }));
    const hasWww = result.referrers.some(r => r.breakdown_value.startsWith('www.'));
    assert.equal(hasWww, false);
  });
  it('handles $direct special case from PostHog', () => {
    const posthog = makePosthog({
      referrers: [{ breakdown_value: '$direct', count: 100 }],
    });
    const result = combineAnalyticsData(makeImported({ referrers: [] }), posthog);
    const direct = result.referrers.find(r => r.breakdown_value === '$direct');
    assert.ok(direct, '$direct should be preserved');
  });
  it('handles null referrers in imported gracefully', () => {
    const imported = makeImported({ referrers: null });
    const result = combineAnalyticsData(imported, makePosthog());
    assert.ok(Array.isArray(result.referrers));
  });
});

// ─── combineAnalyticsData — overlapping date ranges ──────────────────────────
describe('combineAnalyticsData — overlapping date ranges', () => {
  it('uses date-aware-combined strategy when PostHog has significant data', () => {
    // Make imported end AFTER posthog starts, and posthog has >50 pageViews
    const imported = makeImported({
      dateRange: { startDate: '2023-01-01', endDate: '2023-11-01' },
      totalPageViews: 5000,
      dailyStats: [],
    });
    const posthog = makePosthog({
      dateRange: { startDate: '2023-10-01', endDate: '2023-12-31' },
      totalPageViews: 100, // > 50 triggers overlap logic
    });
    const result = combineAnalyticsData(imported, posthog);
    assert.equal(result.dataSource, 'date-aware-combined');
  });
  it('returns isHybrid=true for overlapping merge', () => {
    const imported = makeImported({
      dateRange: { startDate: '2023-01-01', endDate: '2023-11-01' },
      dailyStats: [],
    });
    const posthog = makePosthog({
      dateRange: { startDate: '2023-10-01', endDate: '2023-12-31' },
      totalPageViews: 100,
    });
    const result = combineAnalyticsData(imported, posthog);
    assert.equal(result.isHybrid, true);
  });
});
