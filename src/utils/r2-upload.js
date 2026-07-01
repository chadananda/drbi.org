// R2 upload helper. Pass the request-scoped R2 binding (locals.runtime.env.R2).
// Stores under the drbi.org/ prefix in the shared cdn-assets bucket and returns
// the full public CDN URL (served at cdn.shrtr.com). No AWS keys — uses the binding.
const CDN_BASE = 'https://cdn.shrtr.com';

export async function uploadR2(r2, key, data, contentType) {
  if (!r2) throw new Error('R2 binding not available (env.R2)');
  const objectKey = key.startsWith('drbi.org/') ? key : `drbi.org/${key.replace(/^\/+/, '')}`;
  await r2.put(objectKey, data, { httpMetadata: contentType ? { contentType } : undefined });
  return `${CDN_BASE}/${objectKey}`;
}
