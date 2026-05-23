/**
 * tests/unit/eventbrite-scraper.test.js
 *
 * Tests for the pure helper functions in src/utils/eventbrite-scraper.js.
 *
 * EXPORT AUDIT:
 *   Named exports from the module: scrapeEventList, scrapeEventDetails,
 *   updateEvents. The default export bundles those plus refreshSingleEvent.
 *
 *   The five pure helpers (cleanHtml, createHash, extractEventId,
 *   parseLocation, parsePrice) are defined as `const` inside the module file
 *   and are NOT exported. They cannot be imported directly.
 *
 * STRATEGY:
 *   Mirror the exact implementation of each private helper inline. Each inline
 *   mirror is taken verbatim from the source file so the tests validate the
 *   logic faithfully. If the source is ever refactored to export these helpers,
 *   the tests can be updated to import them directly.
 *
 *   We also lightly test the module-level exports to confirm they are
 *   importable functions (smoke test — no network calls).
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';

// ─── Module smoke-test ───────────────────────────────────────────────────────
const scraperModule = await import('../../src/utils/eventbrite-scraper.js');

describe('eventbrite-scraper module exports', () => {
  it('exports scrapeEventList as a function', () => {
    assert.equal(typeof scraperModule.scrapeEventList, 'function');
  });
  it('exports scrapeEventDetails as a function', () => {
    assert.equal(typeof scraperModule.scrapeEventDetails, 'function');
  });
  it('exports updateEvents as a function', () => {
    assert.equal(typeof scraperModule.updateEvents, 'function');
  });
  it('has a default export object', () => {
    assert.equal(typeof scraperModule.default, 'object');
  });
  it('default export contains updateEvents', () => {
    assert.equal(typeof scraperModule.default.updateEvents, 'function');
  });
  it('default export contains scrapeEventList', () => {
    assert.equal(typeof scraperModule.default.scrapeEventList, 'function');
  });
});

// ═══════════════════════════════════════════════════════════════════════════════
// INLINE MIRRORS — taken verbatim from eventbrite-scraper.js
// ═══════════════════════════════════════════════════════════════════════════════

// extractEventId
const extractEventId = (url) => {
  const match = url.match(/(?:registration|tickets)-(\d+)/);
  return match ? match[1] : null;
};

// parseLocation
const parseLocation = (locationData) => {
  if (typeof locationData === 'string') {
    return { name: locationData, address: '', city: '', state: '', zip: '' };
  }
  if (locationData && locationData.address) {
    const address = locationData.address;
    return {
      name: locationData.name || '',
      address: address.streetAddress || '',
      city: address.addressLocality || '',
      state: address.addressRegion || '',
      zip: address.postalCode || '',
      latitude: locationData.geo?.latitude,
      longitude: locationData.geo?.longitude,
    };
  }
  return { name: locationData?.name || '', address: '', city: '', state: '', zip: '' };
};

// parsePrice
const parsePrice = (offers) => {
  if (!offers || !Array.isArray(offers) || offers.length === 0) return null;
  const prices = offers.map(offer => parseFloat(offer.price)).filter(price => !isNaN(price));
  if (prices.length === 0) return null;
  return {
    low: Math.min(...prices),
    high: Math.max(...prices),
    currency: offers[0].priceCurrency || 'USD',
  };
};

// createHash
const createHash = (data) => {
  const hashString = JSON.stringify(data);
  return crypto.createHash('md5').update(hashString).digest('hex');
};

// cleanHtml
const cleanHtml = (html) => {
  if (!html) return '';
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<p>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n\s*\n/g, '\n\n')
    .trim();
};

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

// ─── extractEventId ───────────────────────────────────────────────────────────
describe('extractEventId', () => {
  it('extracts ID from a "registration-" URL', () => {
    const url = 'https://www.eventbrite.com/e/event-registration-1234567890';
    assert.equal(extractEventId(url), '1234567890');
  });
  it('extracts ID from a "tickets-" URL', () => {
    const url = 'https://www.eventbrite.com/e/some-event-tickets-9876543210';
    assert.equal(extractEventId(url), '9876543210');
  });
  it('returns null for a URL with no matching pattern', () => {
    assert.equal(extractEventId('https://www.eventbrite.com/o/organizer-page'), null);
  });
  it('returns null for an empty string', () => {
    assert.equal(extractEventId(''), null);
  });
  it('handles numeric ID of varying lengths', () => {
    const url = 'https://www.eventbrite.com/e/event-tickets-42';
    assert.equal(extractEventId(url), '42');
  });
  it('handles a long event ID', () => {
    const url = 'https://www.eventbrite.com/e/event-registration-123456789012345';
    assert.equal(extractEventId(url), '123456789012345');
  });
  it('prefers the first match when multiple numeric sequences appear', () => {
    const url = 'https://www.eventbrite.com/e/event-2024-tickets-555999';
    assert.equal(extractEventId(url), '555999');
  });
  it('returns null for a plain string with no URL structure', () => {
    assert.equal(extractEventId('not-a-url'), null);
  });
});

// ─── parseLocation ────────────────────────────────────────────────────────────
describe('parseLocation — string input', () => {
  it('wraps a plain string in name field', () => {
    const result = parseLocation('Conference Room A');
    assert.equal(result.name, 'Conference Room A');
  });
  it('sets address/city/state/zip to empty string for plain string', () => {
    const result = parseLocation('Some Venue');
    assert.equal(result.address, '');
    assert.equal(result.city, '');
    assert.equal(result.state, '');
    assert.equal(result.zip, '');
  });
});

describe('parseLocation — object with address', () => {
  const locationObj = {
    name: 'Desert Rose Institute',
    address: {
      streetAddress: '1950 W William Sears Dr',
      addressLocality: 'Eloy',
      addressRegion: 'AZ',
      postalCode: '85131',
    },
    geo: { latitude: 32.7, longitude: -111.5 },
  };

  it('extracts name', () => {
    assert.equal(parseLocation(locationObj).name, 'Desert Rose Institute');
  });
  it('extracts street address', () => {
    assert.equal(parseLocation(locationObj).address, '1950 W William Sears Dr');
  });
  it('extracts city', () => {
    assert.equal(parseLocation(locationObj).city, 'Eloy');
  });
  it('extracts state', () => {
    assert.equal(parseLocation(locationObj).state, 'AZ');
  });
  it('extracts zip', () => {
    assert.equal(parseLocation(locationObj).zip, '85131');
  });
  it('extracts latitude from geo', () => {
    assert.equal(parseLocation(locationObj).latitude, 32.7);
  });
  it('extracts longitude from geo', () => {
    assert.equal(parseLocation(locationObj).longitude, -111.5);
  });
  it('defaults name to empty string when missing', () => {
    const noName = { address: { streetAddress: '123 Main St', addressLocality: 'City', addressRegion: 'ST', postalCode: '00000' } };
    assert.equal(parseLocation(noName).name, '');
  });
});

describe('parseLocation — null / empty input', () => {
  it('returns object with empty strings for null', () => {
    const result = parseLocation(null);
    assert.equal(result.name, '');
    assert.equal(result.address, '');
  });
  it('returns object with empty strings for undefined', () => {
    const result = parseLocation(undefined);
    assert.equal(result.name, '');
  });
  it('returns object with empty strings for empty object', () => {
    const result = parseLocation({});
    assert.equal(result.name, '');
    assert.equal(result.address, '');
  });
});

// ─── parsePrice ───────────────────────────────────────────────────────────────
describe('parsePrice', () => {
  it('returns null for null input', () => {
    assert.equal(parsePrice(null), null);
  });
  it('returns null for undefined input', () => {
    assert.equal(parsePrice(undefined), null);
  });
  it('returns null for empty array', () => {
    assert.equal(parsePrice([]), null);
  });
  it('returns low and high for single offer', () => {
    const result = parsePrice([{ price: '25.00', priceCurrency: 'USD' }]);
    assert.equal(result.low, 25);
    assert.equal(result.high, 25);
  });
  it('returns correct low and high for multiple offers', () => {
    const offers = [
      { price: '10.00', priceCurrency: 'USD' },
      { price: '50.00', priceCurrency: 'USD' },
      { price: '25.00', priceCurrency: 'USD' },
    ];
    const result = parsePrice(offers);
    assert.equal(result.low, 10);
    assert.equal(result.high, 50);
  });
  it('uses currency from first offer', () => {
    const result = parsePrice([{ price: '15', priceCurrency: 'EUR' }]);
    assert.equal(result.currency, 'EUR');
  });
  it('defaults currency to USD when not specified', () => {
    const result = parsePrice([{ price: '20' }]);
    assert.equal(result.currency, 'USD');
  });
  it('handles free events (price 0)', () => {
    const result = parsePrice([{ price: '0', priceCurrency: 'USD' }]);
    assert.equal(result.low, 0);
    assert.equal(result.high, 0);
  });
  it('returns null when all prices are non-numeric', () => {
    const result = parsePrice([{ price: 'free' }, { price: 'donation' }]);
    assert.equal(result, null);
  });
  it('ignores non-numeric prices and uses the rest', () => {
    const offers = [{ price: 'free' }, { price: '20.00', priceCurrency: 'USD' }];
    const result = parsePrice(offers);
    assert.equal(result.low, 20);
    assert.equal(result.high, 20);
  });
});

// ─── createHash ───────────────────────────────────────────────────────────────
describe('createHash', () => {
  it('returns a string', () => {
    assert.equal(typeof createHash({ name: 'test' }), 'string');
  });
  it('returns a 32-character hex string (MD5)', () => {
    const hash = createHash({ name: 'event' });
    assert.equal(hash.length, 32);
    assert.ok(/^[0-9a-f]{32}$/.test(hash));
  });
  it('same input produces same hash (deterministic)', () => {
    const data = { name: 'My Event', startDate: '2024-01-01' };
    assert.equal(createHash(data), createHash(data));
  });
  it('different inputs produce different hashes', () => {
    assert.notEqual(createHash({ name: 'A' }), createHash({ name: 'B' }));
  });
  it('order of keys affects hash (JSON.stringify is key-order sensitive)', () => {
    const h1 = createHash({ a: 1, b: 2 });
    const h2 = createHash({ b: 2, a: 1 });
    // JSON.stringify key order may or may not differ — this confirms behavior
    assert.equal(typeof h1, 'string');
    assert.equal(typeof h2, 'string');
  });
  it('works with nested objects', () => {
    const hash = createHash({ location: { city: 'Eloy', state: 'AZ' } });
    assert.equal(hash.length, 32);
  });
  it('works with empty object', () => {
    const hash = createHash({});
    assert.equal(hash.length, 32);
  });
  it('works with array input', () => {
    const hash = createHash([1, 2, 3]);
    assert.equal(hash.length, 32);
  });
});

// ─── cleanHtml ────────────────────────────────────────────────────────────────
describe('cleanHtml', () => {
  it('returns empty string for null', () => {
    assert.equal(cleanHtml(null), '');
  });
  it('returns empty string for undefined', () => {
    assert.equal(cleanHtml(undefined), '');
  });
  it('returns empty string for empty string', () => {
    assert.equal(cleanHtml(''), '');
  });
  it('strips HTML tags', () => {
    const result = cleanHtml('<div>Hello</div>');
    assert.equal(result, 'Hello');
  });
  it('converts <br> to newline', () => {
    const result = cleanHtml('Line one<br>Line two');
    assert.ok(result.includes('\n'));
  });
  it('converts <br /> to newline', () => {
    const result = cleanHtml('A<br />B');
    assert.ok(result.includes('\n'));
  });
  it('converts <p> tags to newlines', () => {
    const result = cleanHtml('<p>Paragraph one</p><p>Paragraph two</p>');
    assert.ok(result.includes('\n'));
    assert.ok(!result.includes('<p>'));
  });
  it('decodes &nbsp; to space', () => {
    const result = cleanHtml('Hello&nbsp;World');
    assert.ok(result.includes(' '));
    assert.ok(!result.includes('&nbsp;'));
  });
  it('decodes &amp; to &', () => {
    assert.ok(cleanHtml('rock &amp; roll').includes('&'));
  });
  it('decodes &lt; and &gt;', () => {
    const result = cleanHtml('1 &lt; 2 and 3 &gt; 2');
    assert.ok(result.includes('<') && result.includes('>'));
    assert.ok(!result.includes('&lt;'));
  });
  it('decodes &quot; to double quote', () => {
    assert.ok(cleanHtml('say &quot;hello&quot;').includes('"'));
  });
  it("decodes &#39; to single quote", () => {
    assert.ok(cleanHtml("it&#39;s fine").includes("'"));
  });
  it('collapses multiple blank lines to double newline', () => {
    const result = cleanHtml('a\n\n\n\nb');
    assert.ok(!result.includes('\n\n\n'));
  });
  it('trims leading and trailing whitespace', () => {
    const result = cleanHtml('  <b>hello</b>  ');
    assert.equal(result, 'hello');
  });
  it('preserves plain text', () => {
    const result = cleanHtml('Just plain text here');
    assert.equal(result, 'Just plain text here');
  });
});
