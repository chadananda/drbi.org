// Typed query functions for Turso — all collections
import { db } from './db';
import { isSponsorPageEvent } from './humanitix';

// ─── Types ───────────────────────────────────────────────────────────────────

export interface EventRow {
  id: string;
  title: string;
  short_description: string | null;
  full_description: string | null;
  start_date: string;
  end_date: string | null;
  additional_dates: string; // JSON
  location: string; // JSON
  price: string | null; // JSON
  registration_url: string | null;
  sponsor_page_url: string | null;
  url: string | null;
  main_image: string;
  teacher_image: string;
  images: string; // JSON
  highlights: string; // JSON
  event_schedule: string; // JSON
  refund_policy: string | null;
  organizer: string;
  categories: string; // JSON
  source: string;
  external_id: string | null;
  visible: number;
  featured: number;
  onsite: number;
  is_eventbrite: number;
  eventbrite_id: string | null;
  manually_edited: number;
  last_manual_edit: string | null;
  last_synced: string | null;
  last_modified: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContentRow {
  id: string;
  slug: string;
  collection: string;
  title: string;
  description: string | null;
  desc_125: string | null;
  abstract: string | null;
  body: string | null;
  post_type: string | null;
  language: string;
  draft: number;
  author: string | null;
  editor: string | null;
  category: string | null;
  topics: string; // JSON
  keywords: string; // JSON
  date_published: string | null;
  date_modified: string | null;
  image_src: string | null;
  image_alt: string | null;
  audio: string | null;
  audio_duration: string | null;
  audio_image: string | null;
  narrator: string | null;
  created_at: string;
  updated_at: string;
}

export interface TeamRow {
  id: string;
  name: string;
  role: string | null;
  title: string | null;
  bio: string | null;
  image: string | null;
  email: string | null;
  website: string | null;
  twitter: string | null;
  sort_order: number;
}

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image: string | null;
  topics: string; // JSON
}

export interface TopicRow {
  id: string;
  topic: string;
  slug: string;
  category: string | null;
  description: string | null;
  traffic: number;
}

export interface FaqRow {
  id: string;
  topic: string;
  questions: string; // JSON
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function parseJson<T>(val: string | null, fallback: T): T {
  if (!val) return fallback;
  try { return JSON.parse(val) as T; } catch { return fallback; }
}

// Shape events into the legacy { id, data: {...} } format that pages/components expect
export function shapeEvent(row: EventRow) {
  return {
    id: row.id,
    data: {
      id: row.id,
      name: row.title,
      title: row.title,
      shortDescription: row.short_description ?? '',
      fullDescription: row.full_description ?? '',
      startDate: row.start_date,
      endDate: row.end_date ?? row.start_date,
      additionalDates: parseJson<any[]>(row.additional_dates, []),
      location: parseJson(row.location, {}),
      price: parseJson(row.price, null),
      registrationUrl: row.registration_url ?? '',
      sponsorPageUrl: row.sponsor_page_url ?? '',
      url: row.url ?? '',
      mainImage: row.main_image ?? '',
      teacherImage: row.teacher_image ?? '',
      images: parseJson<string[]>(row.images, []),
      highlights: parseJson<string[]>(row.highlights, []),
      eventSchedule: parseJson<any[]>(row.event_schedule, []),
      refundPolicy: row.refund_policy ?? '',
      organizer: row.organizer,
      categories: parseJson<string[]>(row.categories, []),
      source: row.source,
      externalId: row.external_id ?? '',
      visible: row.visible === 1,
      featured: row.featured === 1,
      onsite: row.onsite === 1,
      isEventbrite: row.is_eventbrite === 1,
      eventbriteId: row.eventbrite_id,
      manuallyEdited: row.manually_edited === 1,
      lastManualEdit: row.last_manual_edit ?? '',
      lastSynced: row.last_synced ?? '',
      lastModified: row.last_modified ?? '',
    }
  };
}

// Shape content into legacy { id, baseid, collection, data, body } format
export function shapeContent(row: ContentRow) {
  return {
    id: row.id,
    baseid: row.slug,
    collection: row.collection,
    body: row.body ?? '',
    data: {
      title: row.title,
      description: row.description ?? '',
      desc_125: row.desc_125 ?? '',
      abstract: row.abstract ?? '',
      url: row.slug,
      post_type: row.post_type ?? 'Article',
      language: row.language,
      draft: row.draft === 1,
      author: row.author ?? '',
      editor: row.editor ?? '',
      category: row.category ?? '',
      topics: parseJson<string[]>(row.topics, []),
      keywords: parseJson<string[]>(row.keywords, []),
      datePublished: row.date_published ? new Date(row.date_published) : new Date(),
      dateModified: row.date_modified ? new Date(row.date_modified) : new Date(),
      image: row.image_src ? { src: row.image_src, alt: row.image_alt ?? '' } : undefined,
      audio: row.audio ?? '',
      audio_duration: row.audio_duration ?? '',
      audio_image: row.audio_image ?? '',
      narrator: row.narrator ?? '',
    }
  };
}

// ─── Events ──────────────────────────────────────────────────────────────────

export async function getEvents() {
  const result = await db.execute(
    'SELECT * FROM events ORDER BY start_date ASC'
  );
  // Sponsor-a-Youth donation pages are Humanitix events but not site events — never list them.
  return (result.rows as unknown as EventRow[]).map(shapeEvent).filter((e) => !isSponsorPageEvent(e.data));
}

export async function getUpcomingEvents() {
  const result = await db.execute(
    "SELECT * FROM events WHERE visible = 1 AND start_date >= datetime('now', '-1 day') ORDER BY start_date ASC"
  );
  return (result.rows as unknown as EventRow[]).map(shapeEvent).filter((e) => !isSponsorPageEvent(e.data));
}

export async function getVisibleEvents() {
  const result = await db.execute(
    'SELECT * FROM events WHERE visible = 1 ORDER BY start_date ASC'
  );
  return (result.rows as unknown as EventRow[]).map(shapeEvent).filter((e) => !isSponsorPageEvent(e.data));
}

export async function getEventById(id: string) {
  const result = await db.execute({
    sql: 'SELECT * FROM events WHERE id = ?',
    args: [id]
  });
  const row = result.rows[0] as unknown as EventRow | undefined;
  return row ? shapeEvent(row) : null;
}

export async function createEvent(data: Record<string, any>) {
  const id = data.id ?? `event-manual-${Date.now()}`;
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO events (id, title, short_description, full_description, start_date, end_date,
      additional_dates, location, price, registration_url, url, main_image, teacher_image,
      images, highlights, event_schedule, refund_policy, organizer, categories, source,
      external_id, visible, featured, onsite, is_eventbrite, eventbrite_id,
      manually_edited, last_manual_edit, last_modified, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      id,
      data.title ?? data.name ?? '',
      data.shortDescription ?? '',
      data.fullDescription ?? '',
      data.startDate ?? '',
      data.endDate ?? '',
      JSON.stringify(data.additionalDates ?? []),
      JSON.stringify(data.location ?? {}),
      data.price ? JSON.stringify(data.price) : null,
      data.registrationUrl ?? '',
      data.url ?? '',
      data.mainImage ?? '',
      data.teacherImage ?? '',
      JSON.stringify(data.images ?? []),
      JSON.stringify(data.highlights ?? []),
      JSON.stringify(data.eventSchedule ?? []),
      data.refundPolicy ?? '',
      data.organizer ?? 'DRBI',
      JSON.stringify(data.categories ?? []),
      data.source ?? 'manual',
      data.externalId ?? data.id ?? null,
      data.visible !== false ? 1 : 0,
      data.featured ? 1 : 0,
      data.onsite !== false ? 1 : 0,
      data.isEventbrite ? 1 : 0,
      data.eventbriteId ?? null,
      1,
      now,
      now,
      now,
    ]
  });
  return getEventById(id);
}

export async function updateEvent(id: string, data: Record<string, any>) {
  const now = new Date().toISOString();
  await db.execute({
    sql: `UPDATE events SET
      title = COALESCE(?, title),
      short_description = COALESCE(?, short_description),
      full_description = COALESCE(?, full_description),
      start_date = COALESCE(?, start_date),
      end_date = COALESCE(?, end_date),
      additional_dates = COALESCE(?, additional_dates),
      location = COALESCE(?, location),
      price = ?,
      registration_url = COALESCE(?, registration_url),
      sponsor_page_url = COALESCE(?, sponsor_page_url),
      url = COALESCE(?, url),
      main_image = COALESCE(?, main_image),
      teacher_image = COALESCE(?, teacher_image),
      images = COALESCE(?, images),
      highlights = COALESCE(?, highlights),
      event_schedule = COALESCE(?, event_schedule),
      organizer = COALESCE(?, organizer),
      visible = COALESCE(?, visible),
      featured = COALESCE(?, featured),
      manually_edited = 1,
      last_manual_edit = ?,
      updated_at = ?
      WHERE id = ?`,
    args: [
      data.title ?? data.name ?? null,
      data.shortDescription ?? null,
      data.fullDescription ?? null,
      data.startDate ?? null,
      data.endDate ?? null,
      data.additionalDates != null ? JSON.stringify(data.additionalDates) : null,
      data.location != null ? JSON.stringify(data.location) : null,
      data.price != null ? JSON.stringify(data.price) : null,
      data.registrationUrl ?? null,
      data.sponsorPageUrl ?? null,
      data.url ?? null,
      data.mainImage ?? null,
      data.teacherImage ?? null,
      data.images != null ? JSON.stringify(data.images) : null,
      data.highlights != null ? JSON.stringify(data.highlights) : null,
      data.eventSchedule != null ? JSON.stringify(data.eventSchedule) : null,
      data.organizer ?? null,
      data.visible != null ? (data.visible ? 1 : 0) : null,
      data.featured != null ? (data.featured ? 1 : 0) : null,
      now,
      now,
      id,
    ]
  });
  return getEventById(id);
}

export async function deleteEvent(id: string) {
  await db.execute({ sql: 'DELETE FROM events WHERE id = ?', args: [id] });
}

export async function toggleEventVisibility(id: string) {
  await db.execute({
    sql: 'UPDATE events SET visible = CASE WHEN visible = 1 THEN 0 ELSE 1 END, updated_at = ? WHERE id = ?',
    args: [new Date().toISOString(), id]
  });
  return getEventById(id);
}

// Upsert an externally-synced event (e.g. Humanitix). NEVER publishes: new rows land as
// DRAFT (visible=0); existing visibility is preserved. Rows a human has manually edited are
// NOT overwritten — only sync bookkeeping (last_synced) updates. Humans own publish + edits.
// See memory [[humanitix-drbi-events]]. Returns { id, action }.
export async function upsertSyncedEvent(data: Record<string, any>) {
  const now = new Date().toISOString();
  const source = data.source ?? 'external';
  const id = data.id ?? `event-${source}-${data.externalId}`;
  const existing = await getEventById(id);

  // Human has taken ownership of this row — touch only sync metadata, never content/visibility.
  if (existing && existing.data.manuallyEdited) {
    await db.execute({
      sql: 'UPDATE events SET last_synced = ?, last_modified = COALESCE(?, last_modified), updated_at = ? WHERE id = ?',
      args: [now, data.lastModified ?? null, now, id]
    });
    return { id, action: 'skipped-manual' as const };
  }

  const visible = data.visible ? 1 : 0; // auto-show only if published+public on the source

  if (existing) {
    // Refresh content + visibility from the source; leave `manually_edited` rows to humans (handled above).
    await db.execute({
      sql: `UPDATE events SET
        title = ?, short_description = ?, full_description = ?, start_date = ?, end_date = ?,
        additional_dates = ?, location = ?, price = ?, registration_url = ?, url = ?,
        main_image = ?, images = ?, organizer = ?, categories = ?, source = ?, external_id = ?,
        visible = ?, last_synced = ?, last_modified = ?, updated_at = ?
        WHERE id = ?`,
      args: [
        data.title ?? '', data.shortDescription ?? '', data.fullDescription ?? '',
        data.startDate ?? '', data.endDate ?? '',
        JSON.stringify(data.additionalDates ?? []), JSON.stringify(data.location ?? {}),
        data.price ? JSON.stringify(data.price) : null,
        data.registrationUrl ?? '', data.url ?? '', data.mainImage ?? '',
        JSON.stringify(data.images ?? []), data.organizer ?? 'DRBI',
        JSON.stringify(data.categories ?? []), source, data.externalId ?? null,
        visible, now, data.lastModified ?? null, now, id,
      ]
    });
    return { id, action: 'updated' as const };
  }

  // New synced row — visibility mirrors the source's published state.
  await db.execute({
    sql: `INSERT INTO events (id, title, short_description, full_description, start_date, end_date,
      additional_dates, location, price, registration_url, url, main_image, teacher_image,
      images, highlights, event_schedule, refund_policy, organizer, categories, source,
      external_id, visible, featured, onsite, is_eventbrite, eventbrite_id,
      manually_edited, last_manual_edit, last_synced, last_modified, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,0,1,0,NULL,0,NULL,?,?,?)`,
    args: [
      id, data.title ?? '', data.shortDescription ?? '', data.fullDescription ?? '',
      data.startDate ?? '', data.endDate ?? '',
      JSON.stringify(data.additionalDates ?? []), JSON.stringify(data.location ?? {}),
      data.price ? JSON.stringify(data.price) : null,
      data.registrationUrl ?? '', data.url ?? '', data.mainImage ?? '', '',
      JSON.stringify(data.images ?? []), JSON.stringify([]), JSON.stringify([]), '',
      data.organizer ?? 'DRBI', JSON.stringify(data.categories ?? []), source,
      data.externalId ?? null, visible, now, data.lastModified ?? null, now,
    ]
  });
  return { id, action: 'created' as const };
}

// ─── Sponsor-a-youth follow-up tracking ─────────────────────────────────────
// Dedupe table so each registrant is asked to sponsor at most once per order.
export async function wasSponsorInvited(orderId: string): Promise<boolean> {
  const r = await db.execute({ sql: 'SELECT 1 FROM sponsor_invites WHERE order_id = ? LIMIT 1', args: [orderId] });
  return r.rows.length > 0;
}
export async function recordSponsorInvite(orderId: string, eventId: string, email: string): Promise<void> {
  await db.execute({
    sql: 'INSERT OR IGNORE INTO sponsor_invites (order_id, event_id, email, sent_at) VALUES (?,?,?,?)',
    args: [orderId, eventId, email, new Date().toISOString()],
  });
}

// ─── Content ─────────────────────────────────────────────────────────────────

export async function getContentByCollection(collection: string) {
  const result = await db.execute({
    sql: 'SELECT * FROM content WHERE collection = ? AND draft = 0 ORDER BY date_published DESC',
    args: [collection]
  });
  return (result.rows as unknown as ContentRow[]).map(shapeContent);
}

export async function getAllContent() {
  const result = await db.execute(
    'SELECT * FROM content WHERE draft = 0 ORDER BY date_published DESC'
  );
  return (result.rows as unknown as ContentRow[]).map(shapeContent);
}

export async function getContentBySlug(slug: string, language = 'en') {
  const result = await db.execute({
    sql: 'SELECT * FROM content WHERE slug = ? AND language = ? LIMIT 1',
    args: [slug, language]
  });
  const row = result.rows[0] as unknown as ContentRow | undefined;
  return row ? shapeContent(row) : null;
}

export async function getContentById(id: string) {
  const result = await db.execute({
    sql: 'SELECT * FROM content WHERE id = ? LIMIT 1',
    args: [id]
  });
  const row = result.rows[0] as unknown as ContentRow | undefined;
  return row ? shapeContent(row) : null;
}

export async function createContent(data: Record<string, any>) {
  const now = new Date().toISOString();
  await db.execute({
    sql: `INSERT INTO content (id, slug, collection, title, description, desc_125, abstract, body,
      post_type, language, draft, author, editor, category, topics, keywords,
      date_published, date_modified, image_src, image_alt, audio, audio_duration,
      audio_image, narrator, created_at, updated_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    args: [
      data.id,
      data.slug ?? data.url ?? data.id,
      data.collection ?? 'articles',
      data.title ?? '',
      data.description ?? '',
      data.desc_125 ?? '',
      data.abstract ?? '',
      data.body ?? data.content ?? '',
      data.post_type ?? 'Article',
      data.language ?? 'en',
      data.draft ? 1 : 0,
      data.author ?? '',
      data.editor ?? '',
      data.category ?? '',
      JSON.stringify(data.topics ?? []),
      JSON.stringify(data.keywords ?? []),
      data.datePublished ?? data.date_published ?? now,
      data.dateModified ?? data.date_modified ?? now,
      data.image?.src ?? data.image_src ?? '',
      data.image?.alt ?? data.image_alt ?? '',
      data.audio ?? '',
      data.audio_duration ?? '',
      data.audio_image ?? '',
      data.narrator ?? '',
      now,
      now,
    ]
  });
  return getContentById(data.id);
}

export async function updateContent(id: string, data: Record<string, any>) {
  const now = new Date().toISOString();
  // Build dynamic update from provided fields only
  const fields: string[] = [];
  const args: any[] = [];

  const map: Record<string, any> = {
    title: data.title,
    description: data.description,
    desc_125: data.desc_125,
    abstract: data.abstract,
    body: data.body ?? data.content,
    post_type: data.post_type,
    language: data.language,
    draft: data.draft != null ? (data.draft ? 1 : 0) : undefined,
    author: data.author,
    editor: data.editor,
    category: data.category,
    topics: data.topics != null ? JSON.stringify(data.topics) : undefined,
    keywords: data.keywords != null ? JSON.stringify(data.keywords) : undefined,
    date_published: data.datePublished ?? data.date_published,
    date_modified: data.dateModified ?? data.date_modified ?? now,
    image_src: data.image?.src ?? data.image_src,
    image_alt: data.image?.alt ?? data.image_alt,
    audio: data.audio,
    audio_duration: data.audio_duration,
    audio_image: data.audio_image,
    narrator: data.narrator,
  };

  for (const [col, val] of Object.entries(map)) {
    if (val !== undefined) {
      fields.push(`${col} = ?`);
      args.push(val);
    }
  }

  fields.push('updated_at = ?');
  args.push(now);
  args.push(id);

  if (fields.length > 1) {
    await db.execute({
      sql: `UPDATE content SET ${fields.join(', ')} WHERE id = ?`,
      args
    });
  }
  return getContentById(id);
}

export async function deleteContent(id: string) {
  await db.execute({ sql: 'DELETE FROM content WHERE id = ?', args: [id] });
}

// ─── Team ────────────────────────────────────────────────────────────────────

export async function getTeam() {
  const result = await db.execute('SELECT * FROM team ORDER BY sort_order ASC');
  return (result.rows as unknown as TeamRow[]).map(row => ({
    id: row.id,
    data: {
      name: row.name,
      role: row.role ?? '',
      title: row.title ?? '',
      bio: row.bio ?? '',
      image: row.image ?? '',
      email: row.email ?? '',
      website: row.website ?? '',
      twitter: row.twitter ?? '',
    }
  }));
}

export async function getTeamMember(id: string) {
  const result = await db.execute({ sql: 'SELECT * FROM team WHERE id = ?', args: [id] });
  const row = result.rows[0] as unknown as TeamRow | undefined;
  if (!row) return null;
  return { id: row.id, data: { name: row.name, role: row.role ?? '', title: row.title ?? '', bio: row.bio ?? '', image: row.image ?? '', email: row.email ?? '', website: row.website ?? '', twitter: row.twitter ?? '' } };
}

export async function getTeamMemberByEmail(email: string) {
  const result = await db.execute({ sql: 'SELECT * FROM team WHERE email = ? LIMIT 1', args: [email] });
  const row = result.rows[0] as unknown as TeamRow | undefined;
  if (!row) return null;
  return { id: row.id, data: { name: row.name, role: row.role ?? '', title: row.title ?? '', bio: row.bio ?? '', image: row.image ?? '', email: row.email ?? '', website: row.website ?? '', twitter: row.twitter ?? '' } };
}

export async function createTeamMember(data: Record<string, any>) {
  const id = data.id ?? data.name.toLowerCase().replace(/\s+/g, '-');
  await db.execute({
    sql: `INSERT INTO team (id, name, role, title, bio, image, email, website, twitter, sort_order)
          VALUES (?,?,?,?,?,?,?,?,?,?)`,
    args: [id, data.name, data.role ?? 'author', data.title ?? '', data.bio ?? '', data.image ?? '', data.email ?? '', data.website ?? '', data.twitter ?? '', data.sort_order ?? 0]
  });
  return getTeamMember(id);
}

export async function updateTeamMember(id: string, data: Record<string, any>) {
  await db.execute({
    sql: `UPDATE team SET name=COALESCE(?,name), role=COALESCE(?,role), title=COALESCE(?,title),
          bio=COALESCE(?,bio), image=COALESCE(?,image), email=COALESCE(?,email),
          website=COALESCE(?,website), twitter=COALESCE(?,twitter)
          WHERE id=?`,
    args: [data.name ?? null, data.role ?? null, data.title ?? null, data.bio ?? null, data.image ?? null, data.email ?? null, data.website ?? null, data.twitter ?? null, id]
  });
  return getTeamMember(id);
}

export async function deleteTeamMember(id: string) {
  await db.execute({ sql: 'DELETE FROM team WHERE id = ?', args: [id] });
}

// ─── Categories ──────────────────────────────────────────────────────────────

export async function getCategories() {
  const result = await db.execute('SELECT * FROM categories ORDER BY name ASC');
  return (result.rows as unknown as CategoryRow[]).map(row => ({
    id: row.id,
    collection: 'categories',
    data: {
      category: row.name,
      category_slug: row.slug,
      description: row.description ?? '',
      // image as string path — getDataCollectionImage expects a string, not an object
      image: row.image ?? '',
      topics: parseJson(row.topics, {}),
    }
  }));
}

export async function getCategoryBySlug(slug: string) {
  const result = await db.execute({ sql: 'SELECT * FROM categories WHERE slug = ? LIMIT 1', args: [slug] });
  const row = result.rows[0] as unknown as CategoryRow | undefined;
  if (!row) return null;
  return { id: row.id, data: { category: row.name, category_slug: row.slug, description: row.description ?? '', image: row.image ?? '', topics: parseJson(row.topics, {}) } };
}

export async function createCategory(data: Record<string, any>) {
  const id = data.id ?? data.slug;
  await db.execute({
    sql: `INSERT INTO categories (id, name, slug, description, image, topics) VALUES (?,?,?,?,?,?)`,
    args: [id, data.name, data.slug, data.description ?? '', data.image ?? '', JSON.stringify(data.topics ?? {})]
  });
  return getCategoryBySlug(data.slug);
}

export async function updateCategory(id: string, data: Record<string, any>) {
  await db.execute({
    sql: `UPDATE categories SET name=COALESCE(?,name), slug=COALESCE(?,slug), description=COALESCE(?,description), image=COALESCE(?,image), topics=COALESCE(?,topics) WHERE id=?`,
    args: [data.name ?? null, data.slug ?? null, data.description ?? null, data.image ?? null, data.topics != null ? JSON.stringify(data.topics) : null, id]
  });
  return getCategoryBySlug(data.slug ?? id);
}

export async function deleteCategory(id: string) {
  await db.execute({ sql: 'DELETE FROM categories WHERE id = ?', args: [id] });
}

// ─── Topics ──────────────────────────────────────────────────────────────────

export async function getTopics() {
  const result = await db.execute('SELECT * FROM topics ORDER BY traffic DESC');
  return (result.rows as unknown as TopicRow[]).map(row => ({
    id: row.id,
    data: {
      topic: row.topic,
      topic_slug: row.slug,
      category: row.category ?? '',
      description: row.description ?? '',
      traffic: row.traffic,
    }
  }));
}

export async function getTopicBySlug(slug: string) {
  const result = await db.execute({ sql: 'SELECT * FROM topics WHERE slug = ? LIMIT 1', args: [slug] });
  const row = result.rows[0] as unknown as TopicRow | undefined;
  if (!row) return null;
  return { id: row.id, data: { topic: row.topic, topic_slug: row.slug, category: row.category ?? '', description: row.description ?? '', traffic: row.traffic } };
}

export async function createTopic(data: Record<string, any>) {
  const id = data.id ?? data.slug;
  await db.execute({
    sql: `INSERT INTO topics (id, topic, slug, category, description, traffic) VALUES (?,?,?,?,?,?)`,
    args: [id, data.topic, data.slug, data.category ?? '', data.description ?? '', data.traffic ?? 0]
  });
  return getTopicBySlug(data.slug);
}

export async function updateTopic(id: string, data: Record<string, any>) {
  await db.execute({
    sql: `UPDATE topics SET topic=COALESCE(?,topic), slug=COALESCE(?,slug), category=COALESCE(?,category), description=COALESCE(?,description), traffic=COALESCE(?,traffic) WHERE id=?`,
    args: [data.topic ?? null, data.slug ?? null, data.category ?? null, data.description ?? null, data.traffic ?? null, id]
  });
  return getTopicBySlug(data.slug ?? id);
}

export async function deleteTopic(id: string) {
  await db.execute({ sql: 'DELETE FROM topics WHERE id = ?', args: [id] });
}

export async function updateFaq(topic: string, questions: Array<{ q: string; a: string }>) {
  await db.execute({
    sql: `INSERT INTO faqs (id, topic, questions) VALUES (?,?,?) ON CONFLICT(id) DO UPDATE SET questions=excluded.questions`,
    args: [topic, topic, JSON.stringify(questions)]
  });
}

// ─── FAQs ────────────────────────────────────────────────────────────────────

export async function getFaqs() {
  const result = await db.execute('SELECT * FROM faqs ORDER BY topic ASC');
  return (result.rows as unknown as FaqRow[]).map(row => ({
    id: row.id,
    data: {
      topic: row.topic,
      questions: parseJson<Array<{ q: string; a: string }>>(row.questions, []),
    }
  }));
}

// ─── Users ───────────────────────────────────────────────────────────────────

// EmDash users schema: role is an INTEGER level, `disabled` (not `active`), no password.
// NOTE: confirm these level values match blogworks/EmDash's role convention.
// `user` = signed-in non-anonymous visitor (can comment; NO admin-panel access).
// Staff roles (author+) are granted by the whitelist. Admin access gate lives in
// middleware.ts (['superadmin','admin','editor','author']) — 'user' is intentionally excluded.
const ROLE_TO_LEVEL: Record<string, number> = { superadmin: 100, admin: 40, editor: 30, author: 20, user: 10 };
function levelToRole(level: number): string {
  if (level >= 100) return 'superadmin';
  if (level >= 40) return 'admin';
  if (level >= 30) return 'editor';
  if (level >= 20) return 'author';
  return 'user';
}
function roleToLevel(role: string): number { return ROLE_TO_LEVEL[role] ?? 10; }

export interface UserRow {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  role: number;             // EmDash integer level
  email_verified: number;
  data: string | null;
  created_at: string;
  updated_at: string;
  disabled: number;
}

function shapeUser(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    name: row.name ?? '',
    avatar: row.avatar_url ?? '',
    role: levelToRole(Number(row.role)),
    active: Number(row.disabled) === 0,
    email_verified: Number(row.email_verified) === 1,
    created_at: row.created_at,
  };
}

export async function getUsers() {
  const result = await db.execute("SELECT id, email, name, avatar_url, role, disabled, email_verified, created_at FROM users ORDER BY created_at ASC");
  return (result.rows as unknown as UserRow[]).map(shapeUser);
}

export async function getUserById(id: string) {
  const result = await db.execute({ sql: 'SELECT * FROM users WHERE id = ? LIMIT 1', args: [id] });
  const row = result.rows[0] as unknown as UserRow | undefined;
  return row ? shapeUser(row) : null;
}

export async function getUserByEmail(email: string) {
  const result = await db.execute({ sql: 'SELECT * FROM users WHERE email = ? LIMIT 1', args: [email.toLowerCase()] });
  const row = result.rows[0] as unknown as UserRow | undefined;
  return row ? shapeUser(row) : null;
}

// Whitelist entry. Passwordless — EmDash users have no password column (hashed_password ignored).
export async function createUser(data: { id: string; email: string; name: string; role: string; avatar?: string; hashed_password?: string }) {
  await db.execute({
    sql: `INSERT INTO users (id, email, name, avatar_url, role, email_verified, disabled) VALUES (?,?,?,?,?,0,0)`,
    args: [data.id, data.email.toLowerCase(), data.name, data.avatar ?? null, roleToLevel(data.role)]
  });
  return getUserById(data.id);
}

export async function updateUser(id: string, data: Record<string, any>) {
  const now = new Date().toISOString();
  const fields: string[] = ['updated_at = ?'];
  const args: any[] = [now];
  if (data.email != null) { fields.unshift('email = ?'); args.unshift(data.email.toLowerCase()); }
  if (data.name != null) { fields.unshift('name = ?'); args.unshift(data.name); }
  if (data.avatar != null) { fields.unshift('avatar_url = ?'); args.unshift(data.avatar); }
  if (data.role != null) { fields.unshift('role = ?'); args.unshift(roleToLevel(data.role)); }
  if (data.active != null) { fields.unshift('disabled = ?'); args.unshift(data.active ? 0 : 1); }
  args.push(id);
  await db.execute({ sql: `UPDATE users SET ${fields.join(', ')} WHERE id = ?`, args });
  return getUserById(id);
}

export async function deleteUser(id: string) {
  await db.execute({ sql: 'DELETE FROM users WHERE id = ?', args: [id] });
}

// ─── Comments ────────────────────────────────────────────────────────────────

export interface CommentRow {
  id: string;
  post_id: string;
  parent_id: string | null;
  name: string;
  email: string | null;
  content: string;
  starred: number;
  approved: number;
  ai_score: number | null;
  created_at: string;
  updated_at: string;
}

function shapeComment(row: CommentRow) {
  return {
    id: row.id,
    postid: row.post_id,
    parentid: row.parent_id,
    name: row.name,
    email: row.email ?? '',
    content: row.content,
    starred: row.starred === 1,
    approved: row.approved === 1,
    ai_score: row.ai_score,
    date: row.created_at,
  };
}

export async function getComments(postId?: string) {
  if (postId) {
    const result = await db.execute({ sql: 'SELECT * FROM comments WHERE post_id = ? ORDER BY created_at ASC', args: [postId] });
    return (result.rows as unknown as CommentRow[]).map(shapeComment);
  }
  const result = await db.execute('SELECT * FROM comments ORDER BY created_at DESC');
  return (result.rows as unknown as CommentRow[]).map(shapeComment);
}

export async function getApprovedComments(postId: string) {
  const result = await db.execute({ sql: 'SELECT * FROM comments WHERE post_id = ? AND approved = 1 ORDER BY created_at ASC', args: [postId] });
  return (result.rows as unknown as CommentRow[]).map(shapeComment);
}

export async function createComment(data: { id: string; post_id: string; parent_id?: string; name: string; email?: string; content: string; approved?: boolean; ai_score?: number }) {
  await db.execute({
    sql: `INSERT INTO comments (id, post_id, parent_id, name, email, content, approved, ai_score) VALUES (?,?,?,?,?,?,?,?)`,
    args: [data.id, data.post_id, data.parent_id ?? null, data.name, data.email ?? null, data.content, data.approved !== false ? 1 : 0, data.ai_score ?? null]
  });
}

export async function updateComment(id: string, data: { starred?: boolean; approved?: boolean; content?: string }) {
  const now = new Date().toISOString();
  const fields: string[] = ['updated_at = ?'];
  const args: any[] = [now];
  if (data.starred != null) { fields.unshift('starred = ?'); args.unshift(data.starred ? 1 : 0); }
  if (data.approved != null) { fields.unshift('approved = ?'); args.unshift(data.approved ? 1 : 0); }
  if (data.content != null) { fields.unshift('content = ?'); args.unshift(data.content); }
  args.push(id);
  await db.execute({ sql: `UPDATE comments SET ${fields.join(', ')} WHERE id = ?`, args });
}

export async function deleteComment(id: string) {
  await db.execute({ sql: 'DELETE FROM comments WHERE id = ?', args: [id] });
}

export async function getCommentStats() {
  const result = await db.execute(`
    SELECT
      COUNT(*) as total,
      SUM(starred) as starred,
      SUM(CASE WHEN approved = 0 THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN created_at > datetime('now', '-7 days') THEN 1 ELSE 0 END) as recent
    FROM comments
  `);
  const row = result.rows[0] as any;
  return { total: Number(row?.total ?? 0), starred: Number(row?.starred ?? 0), pending: Number(row?.pending ?? 0), recent: Number(row?.recent ?? 0) };
}
