export const prerender = false;

// TODO: wire to PocketBase "memories" collection
// Required fields to create: name (text), email (email), caption (text), photos (file, multiple)
// Until PocketBase is configured this returns success so the UI works.
export async function POST({ request }) {
  try {
    const data = await request.formData();
    const name    = data.get('name')?.toString().trim();
    const email   = data.get('email')?.toString().trim();
    const caption = data.get('caption')?.toString().trim() ?? '';
    const files   = data.getAll('photos');

    if (!name || !email) {
      return new Response(JSON.stringify({ success: false, error: 'Name and email are required.' }), {
        status: 400, headers: { 'Content-Type': 'application/json' }
      });
    }

    // ── PocketBase upload (uncomment when collection is ready) ──────────────
    // const pb = new PocketBase(import.meta.env.POCKETBASE_URL);
    // const record = await pb.collection('memories').create({
    //   name, email, caption,
    //   photos: files,   // PocketBase handles multi-file fields
    // });
    // ───────────────────────────────────────────────────────────────────────

    console.log(`Memory submission from ${name} <${email}> — ${files.length} photo(s). Caption: "${caption}"`);

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });

  } catch (err) {
    console.error('Memory submission error:', err);
    return new Response(JSON.stringify({ success: false, error: 'Something went wrong. Please try again.' }), {
      status: 500, headers: { 'Content-Type': 'application/json' }
    });
  }
}
