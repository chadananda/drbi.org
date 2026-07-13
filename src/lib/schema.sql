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

-- Outreach subsystems (see migrations/0002_outreach.sql)
CREATE TABLE IF NOT EXISTS announcements (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  audience TEXT NOT NULL DEFAULT '{}',
  banner INTEGER NOT NULL DEFAULT 0,
  banner_tone TEXT NOT NULL DEFAULT 'info',
  banner_until TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT,
  sent_count INTEGER NOT NULL DEFAULT 0,
  recipient_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS newsletters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  subject TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  send_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  sent_at TEXT,
  sent_count INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS subscribers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  source TEXT NOT NULL DEFAULT 'web',
  tag TEXT,
  confirmed INTEGER NOT NULL DEFAULT 1,
  unsubscribed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_subscribers_email ON subscribers(email);
CREATE INDEX IF NOT EXISTS idx_subscribers_active ON subscribers(unsubscribed);

CREATE TABLE IF NOT EXISTS press_releases (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL DEFAULT '',
  slug TEXT UNIQUE,
  dateline TEXT,
  summary TEXT,
  body TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  published_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_press_slug ON press_releases(slug);
CREATE INDEX IF NOT EXISTS idx_press_status ON press_releases(status);

-- Media library. Bytes in R2 (drbi.org/media/<slug>.<ext>, served via ImageKit);
-- this table is the searchable metadata. Organize by title/description/tags, not folders.
CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  r2_key TEXT NOT NULL UNIQUE,
  url TEXT NOT NULL DEFAULT '',
  filename TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  alt TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  tags TEXT NOT NULL DEFAULT '',
  width INTEGER NOT NULL DEFAULT 0,
  height INTEGER NOT NULL DEFAULT 0,
  bytes INTEGER NOT NULL DEFAULT 0,
  content_type TEXT NOT NULL DEFAULT '',
  described_by TEXT,
  uploaded_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_media_created ON media(created_at DESC);
