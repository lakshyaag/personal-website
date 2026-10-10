-- entry_date is the calendar day, and created_at/updated_at are UTC instants shown in the viewer's zone.
ALTER TABLE journal_entries DROP COLUMN time_zone;
