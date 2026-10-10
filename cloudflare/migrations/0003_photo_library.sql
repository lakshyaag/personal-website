-- One photo library for every feature. Links replace the journal-only join table.
CREATE TABLE photo_links (
  photo_id TEXT NOT NULL REFERENCES photos(id) ON DELETE RESTRICT,
  context TEXT NOT NULL CHECK(context IN ('journal','food','workout','visit')),
  context_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK(position >= 0 AND position < 20),
  PRIMARY KEY(context, context_id, position),
  UNIQUE(photo_id, context, context_id)
);
CREATE INDEX photo_links_photo ON photo_links(photo_id);
INSERT INTO photo_links(photo_id, context, context_id, position)
  SELECT photo_id, 'journal', entry_id, position FROM journal_photos;
DROP TABLE journal_photos;

DROP INDEX photo_draft;
ALTER TABLE photos DROP COLUMN draft_entry_id;
ALTER TABLE photos DROP COLUMN display_key;
ALTER TABLE photos ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private' CHECK(visibility IN ('private','public'));
ALTER TABLE photos ADD COLUMN featured INTEGER NOT NULL DEFAULT 0 CHECK(featured IN (0,1));
ALTER TABLE photos ADD COLUMN title TEXT;
ALTER TABLE photos ADD COLUMN caption TEXT;
ALTER TABLE photos ADD COLUMN location TEXT;
ALTER TABLE photos ADD COLUMN taken_at TEXT;
ALTER TABLE photos ADD COLUMN latitude REAL;
ALTER TABLE photos ADD COLUMN longitude REAL;
ALTER TABLE photos ADD COLUMN show_location INTEGER NOT NULL DEFAULT 0 CHECK(show_location IN (0,1));
ALTER TABLE photos ADD COLUMN camera TEXT;
CREATE INDEX photo_library ON photos(created_at DESC, id DESC);
-- Variant keys derive from generation. Regenerate existing photos so they also get thumbnails.
UPDATE photos SET state='queued', attempts=0, lease_until=NULL WHERE state='ready';
