// post /api/upload_s3 — receives base64 file data, uploads to R2, returns public path
export const prerender = false;

import { uploadR2 } from '../../utils/r2-upload.js';
import { getTeamMemberBySlug, guessContentType } from '@utils/utils.js';
import { lucia } from "../../lib/auth";
import { env } from 'cloudflare:workers';

export const POST = async ({ request }) => {
  if (request.headers.get("Content-Type").includes("application/json")) {
    try {
      const body = await request.json();
      let {filedata, mimeType, s3key, sessionid} = body;
      mimeType = mimeType || guessContentType(s3key);

      // verify session and role
      const { user } = await lucia.validateSession(sessionid);
      if (!user || !['superadmin', 'admin', 'editor', 'writer'].includes(user.role)) {
        return new Response('User authentication failed', { status: 403 });
      }
      // verify team member
      if (!(await getTeamMemberBySlug(user.id))) return new Response('User not found', { status: 404 });
      // make sure we have file data
      if (!filedata) return new Response('No filedata provided', { status: 400 });

      // decode base64 → Uint8Array for R2
      const binaryStr = atob(filedata.includes(',') ? filedata.split(',')[1] : filedata);
      const bytes = new Uint8Array(binaryStr.length);
      for (let i = 0; i < binaryStr.length; i++) bytes[i] = binaryStr.charCodeAt(i);

      const r2 = env.R2;
      console.log('uploading to R2:', s3key, mimeType, filedata.length);
      const s3url = await uploadR2(r2, s3key, bytes, mimeType);

      return s3url ? new Response(JSON.stringify({s3url}), { status: 200 })
                   : new Response('R2 upload failed', { status: 500 });

    } catch (error) {
      console.error('Error processing request:', error);
      return new Response('Server error', { status: 500 });
    }
  } else {
    return new Response('Invalid Content-Type', { status: 415 });
  }
};
