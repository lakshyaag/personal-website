-- Variants are made in the browser (or by import scripts), so there is no processing queue.
-- Unfinished rows wait as pending; scripts/migrate/photos.ts finalizes imported ones.
UPDATE photos SET state='pending' WHERE state IN ('queued','processing','failed');
ALTER TABLE photos DROP COLUMN attempts;
ALTER TABLE photos DROP COLUMN lease_until;
ALTER TABLE photos DROP COLUMN error;
DROP INDEX photo_recovery;
CREATE INDEX photo_cleanup ON photos(state, updated_at);
