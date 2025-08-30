/**
 * API endpoint for media file management
 * Handles file uploads and media operations
 */

import { addMediaFile, removeMediaFile } from '../../utils/cms-utils.js';
import formidable from 'formidable';

export const prerender = false;

/**
 * Handle POST requests - Upload media file
 */
async function handlePost(request) {
  try {
    const form = formidable({
      maxFileSize: 10 * 1024 * 1024, // 10MB limit
      allowEmptyFiles: false,
      multiples: false
    });

    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(request, (err, fields, files) => {
        if (err) reject(err);
        else resolve([fields, files]);
      });
    });

    const file = files.file;
    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Generate destination path
    const timestamp = new Date().toISOString().slice(0, 10);
    const extension = file.originalFilename.split('.').pop();
    const filename = `${timestamp}-${file.originalFilename}`;
    const destinationPath = `media/${filename}`;

    // Copy file to public directory
    const publicUrl = await addMediaFile(file.filepath, destinationPath);

    return new Response(JSON.stringify({
      success: true,
      message: 'File uploaded successfully',
      url: publicUrl,
      filename: filename
    }), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('POST /api/media error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Handle DELETE requests - Remove media file
 */
async function handleDelete(request) {
  try {
    const url = new URL(request.url);
    const filePath = url.searchParams.get('path');
    
    if (!filePath) {
      return new Response(JSON.stringify({ error: 'File path is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Remove leading slash if present
    const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
    const success = await removeMediaFile(cleanPath);
    
    if (success) {
      return new Response(JSON.stringify({
        success: true,
        message: 'File deleted successfully'
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    } else {
      throw new Error('Failed to delete file');
    }
  } catch (error) {
    console.error('DELETE /api/media error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}

/**
 * Main API handlers
 */
export async function POST(context) {
  return handlePost(context.request);
}

export async function DELETE(context) {
  return handleDelete(context.request);
}