// Re-seeds events from src/content/events/*.json into Turso.
// Called after external sync to keep DB in sync with filesystem scraper output.
import { db } from './db';
import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

export async function seedEventsToTurso(): Promise<void> {
  const eventsDir = join(process.cwd(), 'src/content/events');
  const files = readdirSync(eventsDir).filter(f => f.endsWith('.json'));

  for (const file of files) {
    let raw: any;
    try {
      raw = JSON.parse(readFileSync(join(eventsDir, file), 'utf-8'));
    } catch { continue; }

    const e = raw.data ?? raw;
    const id = raw.id ?? file.replace('.json', '');

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
        ?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,
        datetime('now'), datetime('now')
      )`,
      args: [
        id,
        e.name ?? e.title ?? '',
        e.shortDescription ?? e.short_description ?? null,
        e.fullDescription ?? e.full_description ?? null,
        e.startDate ?? e.start_date ?? '',
        e.endDate ?? e.end_date ?? null,
        JSON.stringify(e.additionalDates ?? []),
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
        e.externalId ?? e.eventbrite_id ?? null,
        e.visible ?? 1,
        e.featured ?? 0,
        e.onsite ?? 1,
        e.is_eventbrite ?? (e.url?.includes('eventbrite') ? 1 : 0),
        e.eventbrite_id ?? null,
        e.manually_edited ?? 0,
        e.last_manual_edit ?? null,
        e.last_synced ?? null,
        e.last_modified ?? null,
      ]
    });
  }
}
