// Seed team, categories, topics, faqs from JSON/YAML files into Turso.
// Safe to re-run: uses INSERT OR REPLACE.
import { createClient } from '@libsql/client';
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import yaml from 'js-yaml';
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

// --- Team ---
const teamData = JSON.parse(readFileSync(join(root, 'src/data/team.json'), 'utf-8'));
console.log(`Seeding ${teamData.length} team members...`);
for (const [i, m] of teamData.entries()) {
  await db.execute({
    sql: `INSERT OR REPLACE INTO team (id, name, role, title, bio, image, email, website, twitter, sort_order, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
    args: [
      m.id,
      m.name ?? '',
      m.jobTitle ?? m.role ?? null,
      m.title ?? null,
      m.description ?? m.bio ?? null,
      m.image_src ?? m.image ?? null,
      m.email ?? null,
      m.url ?? m.website ?? null,
      m.sameAs_twitter ?? m.twitter ?? null,
      i,
    ]
  });
}
console.log('  ✓ team done');

// --- Categories (from YAML files) ---
const catDir = join(root, 'src/content/categories');
const catFiles = readdirSync(catDir).filter(f => f.endsWith('.yaml'));
console.log(`Seeding ${catFiles.length} categories...`);
for (const file of catFiles) {
  const raw = yaml.load(readFileSync(join(catDir, file), 'utf-8'));
  const slug = raw.category_slug ?? file.replace('.yaml', '');
  await db.execute({
    sql: `INSERT OR REPLACE INTO categories (id, name, slug, description, image, topics, created_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    args: [
      slug,
      raw.category ?? slug,
      slug,
      raw.description ?? null,
      raw.image?.src ?? null,
      JSON.stringify(raw.topics ?? {}),
    ]
  });
}
console.log('  ✓ categories done');

// --- Topics (from YAML files) ---
const topicsDir = join(root, 'src/content/topics');
const topicFiles = readdirSync(topicsDir).filter(f => f.endsWith('.yaml'));
console.log(`Seeding ${topicFiles.length} topics...`);
for (const file of topicFiles) {
  const raw = yaml.load(readFileSync(join(topicsDir, file), 'utf-8'));
  const slug = raw.topic_slug ?? file.replace('.yaml', '');
  await db.execute({
    sql: `INSERT OR REPLACE INTO topics (id, topic, slug, category, description, traffic, created_at)
          VALUES (?, ?, ?, ?, ?, ?, datetime('now'))`,
    args: [
      slug,
      raw.topic ?? slug,
      slug,
      raw.category ?? null,
      raw.description ?? null,
      raw.traffic ?? 0,
    ]
  });
}
console.log('  ✓ topics done');

// --- FAQs (from YAML files) ---
const faqsDir = join(root, 'src/content/faqs');
const faqFiles = readdirSync(faqsDir).filter(f => f.endsWith('.yaml'));
console.log(`Seeding ${faqFiles.length} FAQs...`);
for (const file of faqFiles) {
  const raw = yaml.load(readFileSync(join(faqsDir, file), 'utf-8'));
  const slug = raw.topic_slug ?? file.replace('.yaml', '');
  await db.execute({
    sql: `INSERT OR REPLACE INTO faqs (id, topic, questions, created_at)
          VALUES (?, ?, ?, datetime('now'))`,
    args: [
      slug,
      raw.topic ?? slug,
      JSON.stringify(raw.faqs ?? []),
    ]
  });
}
console.log('  ✓ faqs done');

console.log('All structured data seeded.');
db.close();
