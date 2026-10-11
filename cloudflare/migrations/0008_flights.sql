-- Flights replace airport visits: one row per flight. Airports, layovers and journeys are derived.
-- `visits` stays until the flights import is verified; a later migration drops it.
CREATE TABLE flights (
  id TEXT PRIMARY KEY,
  -- Local departure date.
  flight_date TEXT NOT NULL CHECK(length(flight_date) = 10),
  -- Airline as the flight lookup (or Flighty) reports it. Displayed as IATA code + number.
  airline_icao TEXT CHECK(length(airline_icao) = 3),
  airline_iata TEXT CHECK(length(airline_iata) = 2),
  airline_name TEXT CHECK(length(airline_name) <= 100),
  flight_number TEXT NOT NULL CHECK(length(flight_number) BETWEEN 1 AND 5),
  from_ident TEXT NOT NULL CHECK(length(from_ident) BETWEEN 1 AND 16),
  to_ident TEXT NOT NULL CHECK(length(to_ident) BETWEEN 1 AND 16),
  -- Local wall-clock gate times (YYYY-MM-DDTHH:MM): actual when known, else scheduled.
  departs_at TEXT CHECK(length(departs_at) = 16),
  arrives_at TEXT CHECK(length(arrives_at) = 16),
  aircraft TEXT CHECK(length(aircraft) <= 100),
  registration TEXT CHECK(length(registration) <= 20),
  seat TEXT CHECK(length(seat) <= 5),
  seat_type TEXT CHECK(seat_type IN ('window','middle','aisle')),
  cabin TEXT CHECK(cabin IN ('economy','premium','business','first')),
  notes TEXT CHECK(length(notes) <= 10000),
  -- Set for flights imported from a Flighty export, so re-imports update rather than duplicate.
  flighty_id TEXT UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK(airline_icao IS NOT NULL OR airline_iata IS NOT NULL)
);
CREATE INDEX flights_by_date ON flights(flight_date DESC, departs_at DESC);

-- Photos can attach to flights. SQLite can't alter a CHECK, so rebuild the table.
CREATE TABLE photo_links_next (
  photo_id TEXT NOT NULL REFERENCES photos(id) ON DELETE RESTRICT,
  context TEXT NOT NULL CHECK(context IN ('journal','food','workout','visit','flight')),
  context_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK(position >= 0 AND position < 20),
  PRIMARY KEY(context, context_id, position),
  UNIQUE(photo_id, context, context_id)
);
INSERT INTO photo_links_next SELECT photo_id, context, context_id, position FROM photo_links;
DROP TABLE photo_links;
ALTER TABLE photo_links_next RENAME TO photo_links;
CREATE INDEX photo_links_photo ON photo_links(photo_id);
