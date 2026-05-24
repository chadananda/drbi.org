// Seed events from src/content/events/*.json into Turso.
// Safe to re-run: uses INSERT OR REPLACE.
import { createClient } from '@libsql/client';
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

const __dirname = dirname(fileURLToPath(import.meta.url));
const eventsDir = join(__dirname, '../src/content/events');

const db = createClient({
  url: process.env.TURSO_URL,
  authToken: process.env.TURSO_TOKEN,
});

if (!process.env.TURSO_URL) throw new Error('TURSO_URL required');
if (!process.env.TURSO_TOKEN) throw new Error('TURSO_TOKEN required');

const files = readdirSync(eventsDir).filter(f => f.endsWith('.json'));
console.log(`Seeding ${files.length} events...`);

let inserted = 0, errors = 0;

for (const file of files) {
  const raw = JSON.parse(readFileSync(join(eventsDir, file), 'utf-8'));

  // Support both flat and nested { data: { ... } } shapes
  const e = raw.data ?? raw;
  const id = raw.id ?? file.replace('.json', '');

  try {
    await db.execute({
      sql: `INSERT OR REPLACE INTO events (
        id, title, short_description, full_description,
        start_date, end_date, additional_dates,
        location, price, registration_url, url,
        main_image, teacher_image, images,
        highlights, event_schedule, refund_policy,
        organizer, categories, source, external_id,
        visible, featured, onsite, is_eventbrite, eventbrite_id,
        manually_edited, last_manual_edit, last_synced, last_modified,
        created_at, updated_at
      ) VALUES (
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?, ?, ?, ?,
        ?, ?, ?, ?,
        datetime('now'), datetime('now')
      )`,
      args: [
        id,
        e.name ?? e.title ?? '',
        e.shortDescription ?? e.short_description ?? null,
        e.fullDescription ?? e.full_description ?? null,
        e.startDate ?? e.start_date ?? '',
        e.endDate ?? e.end_date ?? null,
        JSON.stringify(e.additionalDates ?? e.additional_dates ?? []),
        JSON.stringify(e.location ?? {}),
        e.price != null ? JSON.stringify(e.price) : null,
        e.registrationUrl ?? e.registration_url ?? null,
        e.url ?? null,
        e.mainImage ?? e.main_image ?? '',
        e.teacherImage ?? e.teacher_image ?? '',
        JSON.stringify(e.images ?? []),
        JSON.stringify(e.highlights ?? []),
        JSON.stringify(e.eventSchedule ?? e.event_schedule ?? []),
        e.refundPolicy ?? e.refund_policy ?? null,
        e.organizer ?? 'DRBI',
        JSON.stringify(e.categories ?? []),
        e.source ?? (e.url?.includes('eventbrite') ? 'eventbrite' : 'manual'),
        e.externalId ?? e.external_id ?? e.eventbrite_id ?? null,
        e.visible ?? 1,
        e.featured ?? 0,
        e.onsite ?? 1,
        e.is_eventbrite ?? (e.url?.includes('eventbrite') ? 1 : 0),
        e.eventbrite_id ?? e.externalId ?? null,
        e.manually_edited ?? 0,
        e.last_manual_edit ?? null,
        e.last_synced ?? null,
        e.last_modified ?? null,
      ]
    });
    inserted++;
  } catch (err) {
    console.error(`  ✗ ${file}: ${err.message}`);
    errors++;
  }
}

console.log(`Done: ${inserted} inserted, ${errors} errors.`);
db.close();
