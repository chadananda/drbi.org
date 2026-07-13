// Auto-describe an uploaded image → { title, alt, description, tags, described_by }.
// Two providers (see media library decision):
//   'workers' — Cloudflare Workers AI (env.AI, on-platform, no key). Default for in-app
//               uploads. Weaker captions; one call for a caption, one for tags.
//   'claude'  — Anthropic API (env.ANTHROPIC_API_KEY). Best quality; used for developer/
//               batch uploads. Returns clean JSON in one call.
// Fail-soft: on any error returns a filename-derived fallback with described_by:'manual'.
import { env } from 'cloudflare:workers';

const WORKERS_MODEL = '@cf/llava-hf/llava-1.5-7b-hf';
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001';

function titleFromFilename(filename = '') {
  const base = String(filename).replace(/\.[a-z0-9]+$/i, '').replace(/[-_]+/g, ' ').trim();
  return base ? base.replace(/\b\w/g, (c) => c.toUpperCase()).slice(0, 80) : 'Untitled image';
}
function titleFromText(text, filename) {
  const first = String(text || '').split(/[.!?]/)[0].trim();
  if (!first) return titleFromFilename(filename);
  const words = first.split(/\s+/).slice(0, 7).join(' ');
  return words.replace(/^\w/, (c) => c.toUpperCase()).slice(0, 80);
}
export function fallbackDescription(filename) {
  return { title: titleFromFilename(filename), alt: titleFromFilename(filename),
           description: '', tags: '', described_by: 'manual' };
}
const normTags = (s) => [...new Set(String(s || '').replace(/[.\n]/g, ',').split(',')
  .map((t) => t.trim().toLowerCase().replace(/^#/, '')).filter((t) => t && t.length < 30))].slice(0, 8).join(', ');

// base64 for Anthropic image payloads (chunked to avoid call-stack limits on big buffers).
function toBase64(bytes) {
  const u8 = new Uint8Array(bytes);
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < u8.length; i += CH) bin += String.fromCharCode.apply(null, u8.subarray(i, i + CH));
  return btoa(bin);
}

async function describeWithWorkers({ bytes, filename }) {
  if (!env?.AI) throw new Error('Workers AI binding (env.AI) not available');
  const image = [...new Uint8Array(bytes)];
  const cap = await env.AI.run(WORKERS_MODEL, {
    image,
    prompt: 'Describe this image in one clear, factual sentence suitable as website alt text.',
    max_tokens: 120,
  });
  const caption = String(cap?.description || '').trim();
  let tags = '';
  try {
    const t = await env.AI.run(WORKERS_MODEL, {
      image,
      prompt: 'List 4 to 6 short lowercase keyword tags describing this image, comma-separated. Tags only, no sentence.',
      max_tokens: 60,
    });
    tags = normTags(t?.description || '');
  } catch { /* tags optional */ }
  if (!caption) throw new Error('Workers AI returned no caption');
  return { title: titleFromText(caption, filename), alt: caption, description: caption, tags, described_by: 'workers' };
}

async function describeWithClaude({ bytes, contentType, filename }) {
  const key = env?.ANTHROPIC_API_KEY;
  if (!key) throw new Error('ANTHROPIC_API_KEY not set');
  const media_type = /png|jpe?g|webp|gif/.test(contentType || '') ? contentType : 'image/webp';
  const prompt = 'You are describing an image for a website media library. Respond with ONLY a JSON object '
    + '(no markdown) with keys: "title" (max 8 words), "alt" (one concise factual sentence for screen readers), '
    + '"description" (1-2 sentences of context), "tags" (array of 4-8 short lowercase keywords).';
  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: CLAUDE_MODEL,
      max_tokens: 400,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type, data: toBase64(bytes) } },
        { type: 'text', text: prompt },
      ] }],
    }),
  });
  if (!resp.ok) throw new Error(`Anthropic ${resp.status}: ${await resp.text()}`);
  const data = await resp.json();
  const text = (data?.content || []).map((c) => c.text || '').join('').trim();
  const json = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
  return {
    title: String(json.title || titleFromFilename(filename)).slice(0, 80),
    alt: String(json.alt || '').slice(0, 300),
    description: String(json.description || '').slice(0, 1000),
    tags: normTags(Array.isArray(json.tags) ? json.tags.join(',') : json.tags),
    described_by: 'claude',
  };
}

export async function describeImage({ bytes, contentType, filename, provider = 'workers' }) {
  try {
    if (provider === 'claude') return await describeWithClaude({ bytes, contentType, filename });
    return await describeWithWorkers({ bytes, filename });
  } catch (err) {
    console.error(`describeImage(${provider}) failed:`, err?.message || err);
    // Try the other provider once as a fallback before giving up to manual.
    try {
      if (provider === 'claude' && env?.AI) return await describeWithWorkers({ bytes, filename });
    } catch { /* ignore */ }
    return fallbackDescription(filename);
  }
}
