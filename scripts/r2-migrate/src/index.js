// One-off R2 migration + verification Worker.
// Copies cdn-assets under the `drbi.org/` prefix into drbi-assets, stripping the
// prefix (drbi.org/events/x.jpg -> events/x.jpg). Preserves content-type and
// custom metadata. SRC is treated as strictly read-only: only list() and get().
// Endpoints: /count /copy /verify /sample  — all accept ?cursor= and ?limit=.

const PREFIX = 'drbi.org/';

const json = (o, status = 200) =>
  new Response(JSON.stringify(o, null, 2), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  });

const dstKey = (k) => k.slice(PREFIX.length);

// Page through SRC, tallying objects. Cheap: list() only, 1000 keys per call.
async function count(env, cursor, pages) {
  let n = 0,
    bytes = 0,
    truncated = true;
  for (let i = 0; i < pages && truncated; i++) {
    const r = await env.SRC.list({ prefix: PREFIX, cursor, limit: 1000 });
    for (const o of r.objects) {
      n++;
      bytes += o.size;
    }
    truncated = r.truncated;
    cursor = r.cursor;
  }
  return { added: n, bytes, cursor: truncated ? cursor : null, done: !truncated };
}

// Copy a batch. Skips objects already present in DST with a matching size, so
// the run is idempotent and safely resumable.
async function copy(env, cursor, limit) {
  const r = await env.SRC.list({
    prefix: PREFIX,
    cursor,
    limit,
    include: ['httpMetadata', 'customMetadata'],
  });
  let copied = 0,
    skipped = 0;
  const errors = [];
  for (const o of r.objects) {
    const key = dstKey(o.key);
    if (!key) continue; // the bare "drbi.org/" folder marker, if any
    try {
      const existing = await env.DST.head(key);
      if (existing && existing.size === o.size) {
        skipped++;
        continue;
      }
      const src = await env.SRC.get(o.key);
      if (!src) {
        errors.push({ key: o.key, error: 'source vanished' });
        continue;
      }
      await env.DST.put(key, src.body, {
        httpMetadata: o.httpMetadata,
        customMetadata: o.customMetadata,
      });
      copied++;
    } catch (e) {
      errors.push({ key: o.key, error: String(e && e.message ? e.message : e) });
    }
  }
  return {
    batch: r.objects.length,
    copied,
    skipped,
    errors,
    cursor: r.truncated ? r.cursor : null,
    done: !r.truncated,
  };
}

// Compare SRC vs DST for a page: presence + exact size + etag.
async function verify(env, cursor, limit) {
  const r = await env.SRC.list({ prefix: PREFIX, cursor, limit });
  const mismatches = [];
  let checked = 0;
  for (const o of r.objects) {
    const key = dstKey(o.key);
    if (!key) continue;
    checked++;
    const d = await env.DST.head(key);
    if (!d) mismatches.push({ key, issue: 'missing in dst' });
    else if (d.size !== o.size)
      mismatches.push({ key, issue: 'size', src: o.size, dst: d.size });
    else if (o.etag && d.etag && o.etag !== d.etag)
      mismatches.push({ key, issue: 'etag', src: o.etag, dst: d.etag });
  }
  return {
    checked,
    mismatches,
    cursor: r.truncated ? r.cursor : null,
    done: !r.truncated,
  };
}

// Byte-for-byte: pull both objects in full and compare a SHA-256 of the bytes.
async function sample(env, keys) {
  const out = [];
  for (const key of keys) {
    const s = await env.SRC.get(PREFIX + key);
    const d = await env.DST.get(key);
    if (!s || !d) {
      out.push({ key, ok: false, note: !s ? 'missing in src' : 'missing in dst' });
      continue;
    }
    const [sb, db] = [await s.arrayBuffer(), await d.arrayBuffer()];
    const hash = async (b) =>
      [...new Uint8Array(await crypto.subtle.digest('SHA-256', b))]
        .map((x) => x.toString(16).padStart(2, '0'))
        .join('');
    const [sh, dh] = [await hash(sb), await hash(db)];
    out.push({
      key,
      bytes: sb.byteLength,
      ok: sh === dh && sb.byteLength === db.byteLength,
      sha256: sh,
      dstSha256: dh,
      contentType: {
        src: s.httpMetadata?.contentType ?? null,
        dst: d.httpMetadata?.contentType ?? null,
      },
    });
  }
  return { samples: out, allMatch: out.every((x) => x.ok) };
}

export default {
  async fetch(request, env) {
    const u = new URL(request.url);
    const cursor = u.searchParams.get('cursor') || undefined;
    const limit = Number(u.searchParams.get('limit') || 100);
    try {
      switch (u.pathname) {
        case '/count':
          return json(await count(env, cursor, Number(u.searchParams.get('pages') || 20)));
        case '/copy':
          return json(await copy(env, cursor, limit));
        case '/verify':
          return json(await verify(env, cursor, limit));
        case '/keys': {
          const r = await env.SRC.list({ prefix: PREFIX, cursor, limit });
          return json({
            keys: r.objects.map((o) => ({ key: dstKey(o.key), size: o.size })),
            cursor: r.truncated ? r.cursor : null,
            done: !r.truncated,
          });
        }
        case '/sample':
          return json(await sample(env, (u.searchParams.get('keys') || '').split(',').filter(Boolean)));
        default:
          return json({ endpoints: ['/count', '/copy', '/verify', '/sample'] });
      }
    } catch (e) {
      return json({ error: String(e && e.message ? e.message : e) }, 500);
    }
  },
};
