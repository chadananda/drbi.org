// post /api/upload_s3 — receives base64 file data, uploads to R2, returns public path.
// Auth is handled by the shared content-API guard: cookie session, a D1 API token
// (Authorization: Bearer / X-API-Key), the legacy service token, or a Lucia JWT.
export const prerender = false;

import { uploadR2 } from '../../utils/r2-upload.js';
import { guessContentType } from '@utils/utils.js';
import { requireApi } from '../../lib/server/admin-guard';
import { env } from 'cloudflare:workers';

export const POST = async (context) => {
  const { request } = context;
  if (!request.headers.get('Content-Type')?.includes('application/json'))
    return new Response('Invalid Content-Type', { status: 415 });

  const gate = await requireApi(context, { role: 'author' });
  if (gate.response) return gate.response;

  try {
    const body = await request.json();
    let { filedata, mimeType, s3key } = body;
    mimeType = mimeType || guessContentType(s3key);
    if (!filedata) return new Response('No filedata provided', { status: 400 });

    // decode base64 → Uint8Array for R2
    const binaryStr = atob(filedata.includes(',') ? filedata.split(',')[1] : filedata);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

    const s3url = await uploadR2(env.R2, s3key, bytes, mimeType);
    return s3url
      ? new Response(JSON.stringify({ s3url }), { status: 200, headers: { 'Content-Type': 'application/json' } })
      : new Response('R2 upload failed', { status: 500 });
  } catch (error) {
    console.error('Error processing request:', error);
    return new Response('Server error', { status: 500 });
  }
};
