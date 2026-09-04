// Content collection API: articles, news, memorial and any other `content` row.
// GET /api/admin/content?collection=news&draft=all   POST to create.
// Unlike the public queries this can see drafts, so editors can stage work.
export const prerender = false;
import { db } from '@lib/db';
import { shapeContent, createContent } from '@lib/queries';
import { collectionHandlers } from '@lib/server/api-resource';

export const CONTENT_FIELDS = [
  'slug', 'collection', 'title', 'description', 'desc_125', 'abstract', 'body',
  'post_type', 'language', 'draft', 'author', 'editor', 'category', 'topics',
  'keywords', 'date_published', 'date_modified', 'image_src', 'image_alt',
  'audio', 'audio_duration', 'audio_image', 'narrator',
];

export function validateContent(data, mode) {
  if (mode === 'create') {
    if (!data.title) return 'title is required';
    if (!data.collection) return 'collection is required';
  }
  if (data.slug !== undefined && !/^[a-z0-9-]+$/.test(String(data.slug))) {
    return 'slug must be lowercase letters, numbers and hyphens';
  }
  if (data.draft !== undefined && typeof data.draft !== 'boolean' && ![0, 1].includes(data.draft)) {
    return 'draft must be a boolean';
  }
  return null;
}

const { GET, POST } = collectionHandlers({
  fields: CONTENT_FIELDS,
  validate: validateContent,
  list: async (url) => {
    const collection = url.searchParams.get('collection');
    const draft = url.searchParams.get('draft'); // 'all' | 'only' | default published
    const limit = Math.min(Number(url.searchParams.get('limit')) || 100, 500);
    const where = [];
    const args = [];
    if (collection) { where.push('collection = ?'); args.push(collection); }
    if (draft === 'only') where.push('draft = 1');
    else if (draft !== 'all') where.push('draft = 0');
    const sql = `SELECT * FROM content ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
                 ORDER BY date_published DESC LIMIT ?`;
    const { rows } = await db.execute({ sql, args: [...args, limit] });
    return rows.map(shapeContent);
  },
  create: async (data) => {
    const id = crypto.randomUUID();
    await createContent({ id, ...data });
    const { rows } = await db.execute({ sql: 'SELECT * FROM content WHERE id = ?', args: [id] });
    return rows[0] ? shapeContent(rows[0]) : { id };
  },
});

export { GET, POST };
