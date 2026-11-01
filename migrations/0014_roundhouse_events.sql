-- Roundhouse community events (Kitty's calendar), shown on the /calendar "Roundhouse" tab.
-- date = first (or only) Arizona day; repeat 'weekly' runs until repeat_until (or open-ended).
CREATE TABLE IF NOT EXISTS roundhouse_events (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  date TEXT NOT NULL,
  start_time TEXT,
  end_time TEXT,
  repeat TEXT NOT NULL DEFAULT 'none',
  repeat_until TEXT,
  organizer TEXT,
  notes TEXT,
  visible INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_roundhouse_events_date ON roundhouse_events(date);
