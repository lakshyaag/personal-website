-- The remaining admin features, in the same shared database. Photos attach through photo_links.
-- JSON columns hold small arrays; AI columns are filled by /analyze and cleared when the input changes.
CREATE TABLE food_entries (
  id TEXT PRIMARY KEY,
  entry_date TEXT NOT NULL CHECK(length(entry_date) = 10),
  eaten_at TEXT NOT NULL,
  description TEXT CHECK(length(description) <= 10000),
  ai_food_name TEXT,
  ai_calories REAL,
  ai_protein_g REAL,
  ai_carbs_g REAL,
  ai_fat_g REAL,
  ai_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX food_by_date ON food_entries(entry_date DESC, eaten_at DESC);

CREATE TABLE workout_logs (
  id TEXT PRIMARY KEY,
  log_date TEXT NOT NULL CHECK(length(log_date) = 10),
  content TEXT CHECK(length(content) <= 20000),
  weight REAL,
  ai_session_type TEXT CHECK(ai_session_type IN ('strength','cardio','mixed','other')),
  ai_exercises TEXT,
  ai_total_volume REAL,
  ai_muscle_groups TEXT,
  ai_notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX workouts_by_date ON workout_logs(log_date DESC, created_at DESC);

CREATE TABLE visits (
  id TEXT PRIMARY KEY,
  airport_ident TEXT NOT NULL CHECK(length(airport_ident) BETWEEN 1 AND 16),
  visit_date TEXT NOT NULL CHECK(length(visit_date) = 10),
  flight_numbers TEXT NOT NULL DEFAULT '[]',
  is_layover INTEGER NOT NULL DEFAULT 0 CHECK(is_layover IN (0,1)),
  notes TEXT CHECK(length(notes) <= 10000),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX visits_by_date ON visits(visit_date DESC, created_at DESC);

CREATE TABLE books (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  isbn TEXT,
  cover_url TEXT,
  description TEXT,
  categories TEXT NOT NULL DEFAULT '[]',
  progress INTEGER CHECK(progress BETWEEN 0 AND 100),
  status TEXT NOT NULL CHECK(status IN ('reading','completed','want-to-read')),
  date_started TEXT NOT NULL,
  date_completed TEXT,
  notes TEXT,
  is_current INTEGER NOT NULL DEFAULT 0 CHECK(is_current IN (0,1)),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX books_by_start ON books(date_started DESC);
-- At most one "currently reading" book.
CREATE UNIQUE INDEX books_one_current ON books(is_current) WHERE is_current = 1;

-- Submitted by visitors from the public bookshelf form.
CREATE TABLE recommendations (
  id TEXT PRIMARY KEY,
  book_name TEXT NOT NULL CHECK(length(book_name) BETWEEN 1 AND 300),
  book_author TEXT CHECK(length(book_author) <= 300),
  book_cover_url TEXT CHECK(length(book_cover_url) <= 2000),
  google_books_id TEXT CHECK(length(google_books_id) <= 100),
  recommender_name TEXT CHECK(length(recommender_name) <= 200),
  comment TEXT CHECK(length(comment) <= 2000),
  created_at TEXT NOT NULL
);
CREATE INDEX recommendations_recent ON recommendations(created_at DESC);
