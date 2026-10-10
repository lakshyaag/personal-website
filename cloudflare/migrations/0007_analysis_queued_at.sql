-- Set while a food/workout analysis job is queued, so the admin can show "Analyzing…".
ALTER TABLE food_entries ADD COLUMN analysis_queued_at TEXT;
ALTER TABLE workout_logs ADD COLUMN analysis_queued_at TEXT;
