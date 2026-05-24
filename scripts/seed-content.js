// Seed articles/memorial/news/posts from markdown files into Turso content table.
// Safe to re-run: uses INSERT OR REPLACE.
import { createClient } from '@libsql/client';
import { readFileSync, readdirSync, statSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import matter from 'gray-matter';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const db = createClient({
  url: process.env.TURSO_URL,
  authToken: process.env.TURSO_TOKEN,
});

if (!process.env.TURSO_URL) throw new Error('TURSO_URL required');
if (!process.env.TURSO_TOKEN) throw new Error('TURSO_TOKEN required');

// Collect {filePath, collection, slug} entries from flat or subdirectory layouts
function collectEntries(collection, targetCollection) {
  const dir = join(root, 'src/content', collection);
  const entries = [];
  let items;
  try { items = readdirSync(dir); } catch { return entries; }
  for (const item of items) {
    const itemPath = join(dir, item);
    const stat = statSync(itemPath);
    if (stat.isDirectory()) {
      // Subdirectory layout: posts/my-slug/index.md(oc)
      for (const ext of ['.md', '.mdx', '.mdoc']) {
        const candidate = join(itemPath, `index${ext}`);
        try { statSync(candidate); entries.push({ filePath: candidate, collection: targetCollection, slug: item }); break; } catch {}
      }
    } else if (/\.(md|mdx|mdoc)$/.test(item)) {
      entries.push({ filePath: itemPath, collection: targetCollection, slug: item.replace(/\.(md|mdx|mdoc)$/, '') });
    }
  }
  return entries;
}

const COLLECTION_MAP = [
  ['articles', 'articles'],
  ['memorial', 'memorial'],
  ['news', 'news'],
  ['posts', 'news'], // posts/ subdirectory layout → news collection
];

let total = 0, errors = 0;

for (const [srcDir, targetCollection] of COLLECTION_MAP) {
  const entries = collectEntries(srcDir, targetCollection);
  if (!entries.length) { console.log(`  (no ${srcDir} content, skipping)`); continue; }
  console.log(`Seeding ${entries.length} from ${srcDir} → ${targetCollection}...`);

  for (const { filePath, collection, slug: defaultSlug } of entries) {
    const raw = readFileSync(filePath, 'utf-8');
    const { data: fm, content: body } = matter(raw);

    // Fix known image URL typos (missing extension dot)
    if (fm.image?.src) fm.image.src = fm.image.src.replace(/newsletterpng$/, 'newsletter.png');

    const slug = fm.post_slug ?? fm.url ?? defaultSlug;
    const lang = fm.language ?? 'en';
    const id = `${collection}/${slug}/${lang}`;

    try {
      await db.execute({
        sql: `INSERT OR REPLACE INTO content (
          id, slug, collection, title, description, desc_125, abstract, body,
          post_type, language, draft, author, editor, category,
          topics, keywords, date_published, date_modified,
          image_src, image_alt, audio, audio_duration, audio_image, narrator,
          created_at, updated_at
        ) VALUES (
          ?, ?, ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          ?, ?, ?, ?,
          ?, ?, ?, ?, ?, ?,
          datetime('now'), datetime('now')
        )`,
        args: [
          id,
          slug,
          collection,
          fm.title ?? '',
          fm.description ?? null,
          fm.desc_125 ?? null,
          fm.abstract ?? null,
          body,
          fm.post_type ?? fm.postType ?? null,
          lang,
          fm.draft ? 1 : 0,
          fm.author ?? null,
          fm.editor ?? null,
          fm.category ?? null,
          JSON.stringify(fm.topics ?? []),
          JSON.stringify(fm.keywords ?? []),
          fm.datePublished ?? fm.date_published ?? null,
          fm.dateModified ?? fm.date_modified ?? null,
          fm.image?.src ?? fm.image_src ?? null,
          fm.image?.alt ?? fm.image_alt ?? null,
          fm.audio ?? null,
          fm.audio_duration ?? null,
          fm.audio_image ?? null,
          fm.narrator ?? null,
        ]
      });
      total++;
    } catch (err) {
      console.error(`  ✗ ${collection}/${file}: ${err.message}`);
      errors++;
    }
  }
  console.log(`  ✓ ${srcDir} done`);
}

console.log(`\nTotal: ${total} inserted, ${errors} errors.`);
db.close();
