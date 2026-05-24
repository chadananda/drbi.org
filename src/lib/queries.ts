// Typed query functions for Turso — all collections
import { db } from './db';

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
  return (result.rows as unknown as EventRow[]).map(shapeEvent);
}

export async function getUpcomingEvents() {
  const result = await db.execute(
    "SELECT * FROM events WHERE visible = 1 AND start_date >= datetime('now', '-1 day') ORDER BY start_date ASC"
  );
  return (result.rows as unknown as EventRow[]).map(shapeEvent);
}

export async function getVisibleEvents() {
  const result = await db.execute(
    'SELECT * FROM events WHERE visible = 1 ORDER BY start_date ASC'
  );
  return (result.rows as unknown as EventRow[]).map(shapeEvent);
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
  return { id: row.id, data: { name: row.name, role: row.role ?? '', bio: row.bio ?? '', image: row.image ?? '', email: row.email ?? '' } };
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
  return { id: row.id, data: { category: row.name, category_slug: row.slug, description: row.description ?? '', topics: parseJson(row.topics, {}) } };
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
