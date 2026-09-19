// site.json -> D1 mirror: typed serialization, and the read path's fallbacks.
// Pure module — no D1, no bindings. src/lib/server/site-config.js is a thin
// wrapper that injects the real loader into resolveSiteConfig.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  serializeConfigValue, parseConfigValue, configToRows, rowsToConfig,
  rowOverrides, mergeSiteConfig, resolveSiteConfig, CONFIG_TYPES,
} from '../../src/lib/site-config-format.js';

const STATIC = {
  title: 'Desert Rose Bahá’í Institute',
  phone: '(520) 466-7961',
  languages: ['en', 'fa'],
  youtube: { channel: 'abc', channel_name: 'drbi' },
};

test('serializeConfigValue records the type', async (t) => {
  await t.test('strings stay strings', () => {
    assert.deepEqual(serializeConfigValue('drbi'), { value: 'drbi', value_type: 'string' });
  });
  await t.test('numbers and booleans are distinguishable from their text form', () => {
    assert.deepEqual(serializeConfigValue(42), { value: '42', value_type: 'number' });
    assert.deepEqual(serializeConfigValue(true), { value: 'true', value_type: 'boolean' });
    // The point of value_type: these must not collapse into each other.
    assert.notEqual(serializeConfigValue(true).value_type, serializeConfigValue('true').value_type);
  });
  await t.test('objects and arrays become json', () => {
    assert.deepEqual(serializeConfigValue({ a: 1 }), { value: '{"a":1}', value_type: 'json' });
    assert.deepEqual(serializeConfigValue([1, 2]), { value: '[1,2]', value_type: 'json' });
  });
  await t.test('null and undefined are recorded as null, not the string "null"', () => {
    assert.deepEqual(serializeConfigValue(null), { value: '', value_type: 'null' });
    assert.deepEqual(serializeConfigValue(undefined), { value: '', value_type: 'null' });
  });
  await t.test('every emitted type is a known one', () => {
    for (const v of ['x', 1, true, null, { a: 1 }, ['a']]) {
      assert.ok(CONFIG_TYPES.includes(serializeConfigValue(v).value_type));
    }
  });
});

test('parseConfigValue', async (t) => {
  await t.test('round-trips every type', () => {
    for (const v of ['drbi', 42, true, false, null, { a: 1, b: [2] }, ['en', 'fa']]) {
      assert.deepEqual(parseConfigValue(serializeConfigValue(v)), v);
    }
  });
  await t.test('an empty string survives as an empty string', () => {
    assert.equal(parseConfigValue(serializeConfigValue('')), '');
  });
  await t.test('corrupt json falls back to raw text rather than throwing', () => {
    assert.equal(parseConfigValue({ value: '{not json', value_type: 'json' }), '{not json');
  });
  await t.test('a non-numeric "number" falls back to raw text', () => {
    assert.equal(parseConfigValue({ value: 'abc', value_type: 'number' }), 'abc');
  });
  await t.test('an unknown type is treated as a string', () => {
    assert.equal(parseConfigValue({ value: 'x', value_type: 'wat' }), 'x');
  });
  await t.test('a missing row is undefined, not a throw', () => {
    assert.equal(parseConfigValue(undefined), undefined);
    assert.equal(parseConfigValue(null), undefined);
  });
});

test('configToRows / rowsToConfig', async (t) => {
  await t.test('a whole config round-trips exactly', () => {
    assert.deepEqual(rowsToConfig(configToRows(STATIC)), STATIC);
  });
  await t.test('junk input yields no rows', () => {
    assert.deepEqual(configToRows(null), []);
    assert.deepEqual(configToRows('nope'), []);
  });
  await t.test('rows without a key are skipped', () => {
    assert.deepEqual(rowsToConfig([{ value: 'x', value_type: 'string' }]), {});
  });
});

test('rowOverrides — when D1 is allowed to win', async (t) => {
  await t.test('a real value overrides', () => {
    assert.equal(rowOverrides({ key: 'phone', value: '555', value_type: 'string' }), true);
  });
  await t.test('an empty string does NOT override', () => {
    // Far likelier a half-finished edit than a deliberate blanking, and blanking
    // the site title or address is not a failure mode worth allowing.
    assert.equal(rowOverrides({ key: 'title', value: '', value_type: 'string' }), false);
  });
  await t.test('an explicit null DOES override', () => {
    assert.equal(rowOverrides({ key: 'author_bio', value: '', value_type: 'null' }), true);
  });
  await t.test('a keyless row never overrides', () => {
    assert.equal(rowOverrides({ value: 'x' }), false);
    assert.equal(rowOverrides(null), false);
  });
});

test('mergeSiteConfig', async (t) => {
  const rows = [{ key: 'phone', value: '(555) 000-1111', value_type: 'string' }];

  await t.test('flag off -> static, untouched', () => {
    const r = mergeSiteConfig({ staticConfig: STATIC, rows, enabled: false });
    assert.equal(r.source, 'static');
    assert.equal(r.config.phone, STATIC.phone);
    assert.deepEqual(r.overridden, []);
  });
  await t.test('flag on with rows -> D1 wins for those keys only', () => {
    const r = mergeSiteConfig({ staticConfig: STATIC, rows, enabled: true });
    assert.equal(r.source, 'd1');
    assert.equal(r.config.phone, '(555) 000-1111');
    assert.equal(r.config.title, STATIC.title, 'untouched keys keep the static value');
    assert.deepEqual(r.overridden, ['phone']);
  });
  await t.test('no rows / empty rows -> static', () => {
    for (const v of [null, undefined, []]) {
      assert.equal(mergeSiteConfig({ staticConfig: STATIC, rows: v, enabled: true }).source, 'static');
    }
  });
  await t.test('every static key survives — D1 can never remove one', () => {
    const r = mergeSiteConfig({ staticConfig: STATIC, rows, enabled: true });
    for (const k of Object.keys(STATIC)) assert.ok(k in r.config, `${k} must survive`);
  });
  await t.test('an empty D1 value cannot blank a static value', () => {
    const r = mergeSiteConfig({
      staticConfig: STATIC, enabled: true,
      rows: [{ key: 'title', value: '', value_type: 'string' }],
    });
    assert.equal(r.config.title, STATIC.title);
  });
  await t.test('typed values come back as their real type, not text', () => {
    const r = mergeSiteConfig({
      staticConfig: STATIC, enabled: true,
      rows: [{ key: 'languages', value: '["es"]', value_type: 'json' }],
    });
    assert.deepEqual(r.config.languages, ['es']);
  });
  await t.test('the static object is not mutated', () => {
    const before = JSON.stringify(STATIC);
    mergeSiteConfig({ staticConfig: STATIC, rows, enabled: true });
    assert.equal(JSON.stringify(STATIC), before);
  });
});

test('resolveSiteConfig — the read path and its fallbacks', async (t) => {
  const rows = [{ key: 'phone', value: '(555) 000-1111', value_type: 'string' }];

  await t.test('flag off -> static, and the lookup is never attempted', async () => {
    let called = false;
    const r = await resolveSiteConfig({
      staticConfig: STATIC, enabled: false,
      getRows: async () => { called = true; return rows; },
    });
    assert.equal(r.source, 'static');
    assert.equal(called, false, 'must not query D1 while the feature is off');
  });

  await t.test('happy path -> D1 values applied', async () => {
    const r = await resolveSiteConfig({ staticConfig: STATIC, enabled: true, getRows: async () => rows });
    assert.equal(r.config.phone, '(555) 000-1111');
  });

  await t.test('lookup throws -> static, error does not propagate', async () => {
    const r = await resolveSiteConfig({
      staticConfig: STATIC, enabled: true,
      getRows: async () => { throw new Error('D1 unreachable'); },
    });
    assert.equal(r.source, 'static');
    assert.equal(r.config.title, STATIC.title, 'an unreachable D1 must not blank the site');
  });

  await t.test('lookup returns null -> static', async () => {
    const r = await resolveSiteConfig({ staticConfig: STATIC, enabled: true, getRows: async () => null });
    assert.equal(r.source, 'static');
  });

  await t.test('no loader supplied -> static rather than a crash', async () => {
    const r = await resolveSiteConfig({ staticConfig: STATIC, enabled: true });
    assert.equal(r.source, 'static');
  });

  await t.test('called with nothing at all -> empty config, no throw', async () => {
    const r = await resolveSiteConfig();
    assert.deepEqual(r.config, {});
    assert.equal(r.source, 'static');
  });
});
