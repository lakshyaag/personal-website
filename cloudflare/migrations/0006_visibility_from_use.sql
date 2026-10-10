-- Visibility now follows use: a photo is public when it is in the gallery or on an airport visit
-- (unless hidden from the map), private otherwise. The Worker keeps it in sync on every change.
ALTER TABLE photos ADD COLUMN map_hidden INTEGER NOT NULL DEFAULT 0 CHECK(map_hidden IN (0, 1));
UPDATE photos SET visibility = CASE
  WHEN featured = 1 OR EXISTS(SELECT 1 FROM photo_links WHERE photo_id = photos.id AND context = 'visit')
  THEN 'public' ELSE 'private' END;
-- The library is a timeline by date taken.
CREATE INDEX photos_taken ON photos(state, taken_at DESC, created_at DESC, id DESC);
