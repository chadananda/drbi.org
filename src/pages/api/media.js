// Media file management API. Node-only (formidable + filesystem); not available on Workers.
// cms-utils and formidable are dynamically imported so module load does not throw on Workers.
export const prerender = false;

async function handlePost(request) {
  try {
    const formidable = (await import('formidable')).default;
    const { addMediaFile } = await import('../../utils/cms-utils.js');
    const form = formidable({ maxFileSize: 10 * 1024 * 1024, allowEmptyFiles: false, multiples: false });
    const [fields, files] = await new Promise((resolve, reject) => {
      form.parse(request, (err, fields, files) => err ? reject(err) : resolve([fields, files]));
    });
    const file = files.file;
    if (!file) return new Response(JSON.stringify({ error: 'No file provided' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `${timestamp}-${file.originalFilename}`;
    const publicUrl = await addMediaFile(file.filepath, `media/${filename}`);
    return new Response(JSON.stringify({ success: true, message: 'File uploaded successfully', url: publicUrl, filename }), { status: 201, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    console.error('POST /api/media error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

async function handleDelete(request) {
  try {
    const { removeMediaFile } = await import('../../utils/cms-utils.js');
    const url = new URL(request.url);
    const filePath = url.searchParams.get('path');
    if (!filePath) return new Response(JSON.stringify({ error: 'File path is required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;
    const success = await removeMediaFile(cleanPath);
    if (success) return new Response(JSON.stringify({ success: true, message: 'File deleted successfully' }), { status: 200, headers: { 'Content-Type': 'application/json' } });
    throw new Error('Failed to delete file');
  } catch (error) {
    console.error('DELETE /api/media error:', error);
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}

export async function POST(context) { return handlePost(context.request); }
export async function DELETE(context) { return handleDelete(context.request); }
