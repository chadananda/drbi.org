// Seed articles/memorial/news from markdown files into Turso content table.
// Safe to re-run: uses INSERT OR REPLACE.
import { createClient } from '@libsql/client';
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import matter from 'gray-matter';
import dotenv from 'dotenv';
import { randomUUID } from 'crypto';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const db = createClient({
  url: process.env.TURSO_URL,
  authToken: process.env.TURSO_TOKEN,
});

if (!process.env.TURSO_URL) throw new Error('TURSO_URL required');
if (!process.env.TURSO_TOKEN) throw new Error('TURSO_TOKEN required');

const COLLECTIONS = ['articles', 'memorial', 'news'];
let total = 0, errors = 0;

for (const collection of COLLECTIONS) {
  const dir = join(root, 'src/content', collection);
  let files;
  try {
    files = readdirSync(dir).filter(f => f.endsWith('.md') || f.endsWith('.mdx'));
  } catch {
    console.log(`  (no ${collection} directory, skipping)`);
    continue;
  }

  console.log(`Seeding ${files.length} ${collection}...`);

  for (const file of files) {
    const raw = readFileSync(join(dir, file), 'utf-8');
    const { data: fm, content: body } = matter(raw);

    const slug = fm.url ?? file.replace(/\.(md|mdx)$/, '');
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
  console.log(`  ✓ ${collection} done`);
}

console.log(`\nTotal: ${total} inserted, ${errors} errors.`);
db.close();
