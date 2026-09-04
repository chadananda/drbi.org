// D1 page loader helpers: eligibility, fallback, and image-path rewriting.
// Pure module — no D1, no bindings. The loader's own hit/miss behaviour is
// exercised against a stubbed db below.
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  hasRelativeImages, relativeImages, baseDirFor, normalisePath,
  rewriteImagePaths, canRenderFromD1, hasCodeBlock, skipReason, decidePage, resolvePage,
} from '../../src/lib/page-render.js';

const CDN = 'https://cdn.example.com/drbi.org';

test('detecting relative references', async (t) => {
  await t.test('markdown image syntax', () => {
    assert.equal(hasRelativeImages('![a](./_agr2.webp)'), true);
    assert.equal(hasRelativeImages('![a](../up.jpg)'), true);
  });
  await t.test('raw HTML src/href, which several pages use', () => {
    assert.equal(hasRelativeImages('<img src="./_x.jpg" />'), true);
    assert.equal(hasRelativeImages("<a href='../b.png'>x</a>"), true);
  });
  await t.test('absolute references are not relative', () => {
    assert.equal(hasRelativeImages('![a](/documents/x.jpg)'), false);
    assert.equal(hasRelativeImages('![a](https://cdn/x.jpg)'), false);
    assert.equal(hasRelativeImages('<img src="/documents/x.jpg">'), false);
  });
  await t.test('empty and junk input', () => {
    assert.equal(hasRelativeImages(''), false);
    assert.equal(hasRelativeImages(undefined), false);
  });
  await t.test('repeated calls are stable (no sticky regex lastIndex)', () => {
    const md = '![a](./x.webp)';
    assert.equal(hasRelativeImages(md), true);
    assert.equal(hasRelativeImages(md), true, 'a global regex must not alternate');
  });
  await t.test('lists every reference found', () => {
    assert.deepEqual(
      relativeImages('![a](./one.jpg) and <img src="./two.png">'),
      ['./one.jpg', './two.png'],
    );
  });
});

test('path helpers', async (t) => {
  await t.test('baseDirFor uses the source file, not the route', () => {
    assert.equal(baseDirFor('src/pages/history/william-sears.md'), 'history');
    assert.equal(baseDirFor('src/pages/history/index.md'), 'history');
    assert.equal(baseDirFor('src/pages/terms.md'), '');
  });
  await t.test('normalisePath resolves . and ..', () => {
    assert.equal(normalisePath('history/./x.jpg'), 'history/x.jpg');
    assert.equal(normalisePath('history/../x.jpg'), 'x.jpg');
    assert.equal(normalisePath('a/b/../../c.jpg'), 'c.jpg');
  });
});

test('rewriteImagePaths', async (t) => {
  await t.test('rewrites markdown images against the source directory', () => {
    assert.equal(
      rewriteImagePaths('![Bill](./_bill.jpg)', { cdnBase: CDN, sourcePath: 'src/pages/history/william-sears.md' }),
      `![Bill](${CDN}/history/_bill.jpg)`,
    );
  });
  await t.test('rewrites raw HTML src', () => {
    assert.equal(
      rewriteImagePaths('<img src="./_a.webp">', { cdnBase: CDN, sourcePath: 'src/pages/agriculture/index.md' }),
      `<img src="${CDN}/agriculture/_a.webp">`,
    );
  });
  await t.test('resolves ../ upward', () => {
    assert.equal(
      rewriteImagePaths('![x](../shared.png)', { cdnBase: CDN, sourcePath: 'src/pages/history/a.md' }),
      `![x](${CDN}/shared.png)`,
    );
  });
  await t.test('a root-level page has no directory segment', () => {
    assert.equal(
      rewriteImagePaths('![x](./y.png)', { cdnBase: CDN, sourcePath: 'src/pages/terms.md' }),
      `![x](${CDN}/y.png)`,
    );
  });
  await t.test('leaves absolute references untouched', () => {
    const md = '![a](/documents/x.jpg) ![b](https://cdn/y.jpg) <img src="/z.png">';
    assert.equal(rewriteImagePaths(md, { cdnBase: CDN, sourcePath: 'src/pages/terms.md' }), md);
  });
  await t.test('without a CDN base it is a no-op', () => {
    const md = '![a](./x.jpg)';
    assert.equal(rewriteImagePaths(md, { cdnBase: '', sourcePath: 'src/pages/terms.md' }), md);
  });
  await t.test('trailing slashes on the base do not double up', () => {
    assert.equal(
      rewriteImagePaths('![x](./y.png)', { cdnBase: CDN + '/', sourcePath: 'src/pages/terms.md' }),
      `![x](${CDN}/y.png)`,
    );
  });
});

test('eligibility', async (t) => {
  await t.test('plain body with no relative images is servable', () => {
    assert.equal(canRenderFromD1('# Hello\n\ntext', ''), true);
    assert.equal(skipReason('# Hello', ''), null);
  });
  await t.test('relative images without a CDN base are refused', () => {
    assert.equal(canRenderFromD1('![a](./x.jpg)', ''), false);
    assert.match(skipReason('![a](./x.jpg)', ''), /unresolvable relative images/);
  });
  await t.test('relative images become servable once a base is configured', () => {
    assert.equal(canRenderFromD1('![a](./x.jpg)', CDN), true);
  });
  await t.test('code blocks are refused regardless of CDN base', () => {
    assert.equal(hasCodeBlock('```js\nx\n```'), true);
    assert.equal(hasCodeBlock('~~~\nx\n~~~'), true);
    assert.equal(canRenderFromD1('```js\nx\n```', CDN), false);
    assert.match(skipReason('```js\nx\n```', CDN), /code block/);
  });
  await t.test('indented CSS inside a style block is not a code block', () => {
    assert.equal(hasCodeBlock('<style>\n    display: block;\n</style>'), false);
  });
});

test('decidePage — the serve-or-fall-back decision', async (t) => {
  const row = {
    route: '/terms', html: '<p>Terms</p>', body: 'Terms',
    source_path: 'src/pages/terms.md', draft: 0,
  };

  await t.test('HIT: flag on, eligible row -> served from D1', () => {
    const v = decidePage({ row, enabled: true, cdnBase: '' });
    assert.equal(v.serve, true);
    assert.equal(v.html, '<p>Terms</p>');
  });

  await t.test('MISS: no row (or D1 unreachable) -> falls back to file', () => {
    const v = decidePage({ row: null, enabled: true });
    assert.equal(v.serve, false);
    assert.equal(v.reason, 'no row');
  });

  await t.test('flag off -> falls back even when the row is perfect', () => {
    const v = decidePage({ row, enabled: false });
    assert.equal(v.serve, false);
    assert.equal(v.reason, 'flag off');
  });

  await t.test('row without rendered html -> falls back', () => {
    const v = decidePage({ row: { ...row, html: null }, enabled: true });
    assert.equal(v.serve, false);
    assert.equal(v.reason, 'no rendered html');
  });

  await t.test('draft row -> falls back', () => {
    const v = decidePage({ row: { ...row, draft: 1 }, enabled: true });
    assert.equal(v.serve, false);
    assert.equal(v.reason, 'draft');
  });

  await t.test('unresolvable relative images -> falls back rather than 404 the image', () => {
    const dirty = { ...row, html: '<img src="./_a.webp">', body: '![a](./_a.webp)' };
    const v = decidePage({ row: dirty, enabled: true, cdnBase: '' });
    assert.equal(v.serve, false);
    assert.match(v.reason, /unresolvable relative images/);
  });

  await t.test('same row is served once a CDN base exists, with paths rewritten', () => {
    const dirty = {
      ...row, route: '/history/x', source_path: 'src/pages/history/x.md',
      html: '<img src="./_a.webp">', body: '![a](./_a.webp)',
    };
    const v = decidePage({ row: dirty, enabled: true, cdnBase: CDN });
    assert.equal(v.serve, true);
    assert.equal(v.html, `<img src="${CDN}/history/_a.webp">`);
  });

  await t.test('the row object is never mutated — rewriting happens in the render path', () => {
    const dirty = {
      ...row, source_path: 'src/pages/history/x.md',
      html: '<img src="./_a.webp">', body: '![a](./_a.webp)',
    };
    const before = dirty.html;
    decidePage({ row: dirty, enabled: true, cdnBase: CDN });
    assert.equal(dirty.html, before, 'decidePage must not write back to the row');
  });
});

// resolvePage is the loader's orchestration with the row lookup injected — the
// same code path src/lib/server/d1-pages.js runs in the Worker, minus the
// binding. These are the tests that make the "never 500, always fall back"
// claim real.
test('resolvePage — loader behaviour', async (t) => {
  const row = {
    route: '/terms', html: '<p>Terms</p>', body: 'Terms',
    source_path: 'src/pages/terms.md', draft: 0, has_components: 0, is_route: 1,
  };
  const stub = (r) => async () => r;

  await t.test('flag off -> null, and the lookup is never even attempted', async () => {
    let called = false;
    const res = await resolvePage({
      route: '/terms', enabled: false,
      getRow: async () => { called = true; return row; },
    });
    assert.equal(res, null);
    assert.equal(called, false, 'must not query D1 while the feature is off');
  });

  await t.test('no row -> null (file fallback)', async () => {
    assert.equal(await resolvePage({ route: '/terms', enabled: true, getRow: stub(null) }), null);
  });

  await t.test("row with html='' -> null", async () => {
    assert.equal(await resolvePage({ route: '/terms', enabled: true, getRow: stub({ ...row, html: '' }) }), null);
  });

  await t.test('lookup throws -> null, error does not propagate', async () => {
    const res = await resolvePage({
      route: '/terms', enabled: true,
      getRow: async () => { throw new Error('D1 unreachable'); },
    });
    assert.equal(res, null, 'an unreachable database must never 500 a live page');
  });

  await t.test('component page excluded even if the query returns it', async () => {
    const res = await resolvePage({
      route: '/radio', enabled: true, getRow: stub({ ...row, has_components: 1 }),
    });
    assert.equal(res, null);
  });

  await t.test('draft row excluded', async () => {
    assert.equal(await resolvePage({ route: '/terms', enabled: true, getRow: stub({ ...row, draft: 1 }) }), null);
  });

  await t.test('non-route row excluded', async () => {
    assert.equal(await resolvePage({ route: '/x', enabled: true, getRow: stub({ ...row, is_route: 0 }) }), null);
  });

  await t.test('happy path -> serves the stored html', async () => {
    const res = await resolvePage({ route: '/terms', enabled: true, getRow: stub(row) });
    assert.ok(res);
    assert.equal(res.html, '<p>Terms</p>');
    assert.equal(res.row.route, '/terms');
  });

  await t.test('happy path with a CDN base -> html is rewritten', async () => {
    const dirty = {
      ...row, route: '/history/x', source_path: 'src/pages/history/x.md',
      html: '<img src="./_a.webp">', body: '![a](./_a.webp)',
    };
    const res = await resolvePage({ route: '/history/x', enabled: true, cdnBase: CDN, getRow: stub(dirty) });
    assert.equal(res.html, `<img src="${CDN}/history/_a.webp">`);
  });

  await t.test('relative images with no CDN base -> null rather than a 404 image', async () => {
    const dirty = { ...row, html: '<img src="./_a.webp">', body: '![a](./_a.webp)' };
    assert.equal(await resolvePage({ route: '/history/x', enabled: true, getRow: stub(dirty) }), null);
  });
});
