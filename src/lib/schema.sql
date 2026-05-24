-- drbi.org Turso schema
-- All JSON columns store serialized arrays/objects as TEXT

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  short_description TEXT,
  full_description TEXT,
  start_date TEXT NOT NULL,
  end_date TEXT,
  additional_dates TEXT DEFAULT '[]',
  location TEXT NOT NULL DEFAULT '{}',
  price TEXT,
  registration_url TEXT,
  url TEXT,
  main_image TEXT DEFAULT '',
  teacher_image TEXT DEFAULT '',
  images TEXT DEFAULT '[]',
  highlights TEXT DEFAULT '[]',
  event_schedule TEXT DEFAULT '[]',
  refund_policy TEXT,
  organizer TEXT DEFAULT 'DRBI',
  categories TEXT DEFAULT '[]',
  source TEXT DEFAULT 'manual',
  external_id TEXT,
  visible INTEGER NOT NULL DEFAULT 1,
  featured INTEGER NOT NULL DEFAULT 0,
  onsite INTEGER NOT NULL DEFAULT 1,
  is_eventbrite INTEGER NOT NULL DEFAULT 0,
  eventbrite_id TEXT,
  manually_edited INTEGER NOT NULL DEFAULT 0,
  last_manual_edit TEXT,
  last_synced TEXT,
  last_modified TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_events_start_date ON events(start_date);
CREATE INDEX IF NOT EXISTS idx_events_visible ON events(visible);

CREATE TABLE IF NOT EXISTS content (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL,
  collection TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  desc_125 TEXT,
  abstract TEXT,
  body TEXT,
  post_type TEXT,
  language TEXT NOT NULL DEFAULT 'en',
  draft INTEGER NOT NULL DEFAULT 0,
  author TEXT,
  editor TEXT,
  category TEXT,
  topics TEXT NOT NULL DEFAULT '[]',
  keywords TEXT NOT NULL DEFAULT '[]',
  date_published TEXT,
  date_modified TEXT,
  image_src TEXT,
  image_alt TEXT,
  audio TEXT,
  audio_duration TEXT,
  audio_image TEXT,
  narrator TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(slug, language)
);

CREATE INDEX IF NOT EXISTS idx_content_collection ON content(collection);
CREATE INDEX IF NOT EXISTS idx_content_slug ON content(slug);
CREATE INDEX IF NOT EXISTS idx_content_draft ON content(draft);
CREATE INDEX IF NOT EXISTS idx_content_author ON content(author);

CREATE TABLE IF NOT EXISTS team (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT,
  title TEXT,
  bio TEXT,
  image TEXT,
  email TEXT,
  website TEXT,
  twitter TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  description TEXT,
  image TEXT,
  topics TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS topics (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  category TEXT,
  description TEXT,
  traffic INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS faqs (
  id TEXT PRIMARY KEY,
  topic TEXT NOT NULL,
  questions TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  hashed_password TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'author',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  parent_id TEXT,
  name TEXT NOT NULL,
  email TEXT,
  content TEXT NOT NULL,
  starred INTEGER NOT NULL DEFAULT 0,
  approved INTEGER NOT NULL DEFAULT 1,
  ai_score REAL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_comments_post_id ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_comments_approved ON comments(approved);
