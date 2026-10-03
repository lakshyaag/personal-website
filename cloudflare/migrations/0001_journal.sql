PRAGMA foreign_keys = ON;
CREATE TABLE journal_entries (
  id TEXT PRIMARY KEY,
  entry_date TEXT NOT NULL CHECK(length(entry_date) = 10),
  time_zone TEXT NOT NULL,
  content TEXT NOT NULL CHECK(length(content) <= 100000),
  version INTEGER NOT NULL CHECK(version > 0),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_mutation TEXT NOT NULL
);
CREATE INDEX journal_date_page ON journal_entries(entry_date DESC, created_at DESC, id DESC);
CREATE TABLE photos (
  id TEXT PRIMARY KEY,
  draft_entry_id TEXT NOT NULL,
  file_name TEXT NOT NULL,
  mime_type TEXT NOT NULL CHECK(mime_type IN ('image/jpeg','image/png','image/webp','image/avif')),
  byte_size INTEGER NOT NULL CHECK(byte_size > 0 AND byte_size <= 20971520),
  state TEXT NOT NULL CHECK(state IN ('pending','queued','processing','ready','failed','deleting')),
  width INTEGER,
  height INTEGER,
  error TEXT,
  display_key TEXT,
  generation TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  lease_until TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX photo_recovery ON photos(state, updated_at);
CREATE INDEX photo_draft ON photos(draft_entry_id);
CREATE TABLE journal_photos (
  entry_id TEXT NOT NULL REFERENCES journal_entries(id) ON DELETE CASCADE,
  photo_id TEXT NOT NULL UNIQUE REFERENCES photos(id) ON DELETE RESTRICT,
  position INTEGER NOT NULL CHECK(position >= 0 AND position < 20),
  PRIMARY KEY(entry_id, position)
);
-- A failed optimistic write or attachment check aborts the entire D1 batch.
CREATE TABLE write_assertions (
  id TEXT PRIMARY KEY,
  ok INTEGER NOT NULL CHECK(ok = 1)
);
