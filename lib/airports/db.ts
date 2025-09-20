import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

export type Airport = {
	ident: string;
	our_id: number | null;
	type: string | null;
	name: string | null;
	latitude_deg: number | null;
	longitude_deg: number | null;
	elevation_ft: number | null;
	continent: string | null;
	iso_country: string | null;
	iso_region: string | null;
	municipality: string | null;
	gps_code: string | null;
	iata_code: string | null;
	local_code: string | null;
};

export type AirportRow = Airport & {
	visited: number;
	visited_at: string | null;
};

let dbInstance: Database.Database | null = null;

function getPreferredDatabaseFilePath(): string {
	const configured = process.env.AIRPORTS_DB_PATH;
	if (configured && configured.trim().length > 0) return configured;
	// Force in-memory if requested
	if (process.env.AIRPORTS_DB_IN_MEMORY === "1") return ":memory:";
	// Prefer persistent path in dev, fallback to /tmp in prod/serverless
	const isServerless = process.env.VERCEL === "1" || process.env.NEXT_RUNTIME === "edge" || process.env.NODE_ENV === "production";
	if (isServerless) {
		return path.join("/tmp", "airports.sqlite");
	}
	return path.join(process.cwd(), ".data", "airports.sqlite");
}

function ensureDirectoryExistsOrFallback(preferredPath: string): string {
	const preferredDir = path.dirname(preferredPath);
	try {
		if (!fs.existsSync(preferredDir)) {
			fs.mkdirSync(preferredDir, { recursive: true });
		}
		return preferredPath;
	} catch {
		const fallbackPath = path.join("/tmp", path.basename(preferredPath));
		try {
			// /tmp should exist on most runtimes; ensure just in case
			if (!fs.existsSync("/tmp")) {
				fs.mkdirSync("/tmp", { recursive: true });
			}
			return fallbackPath;
		} catch {
			// Last resort: in-memory database; note: this won't persist across requests
			return ":memory:";
		}
	}
}

function migrate(database: Database.Database) {
	database.exec(`
		PRAGMA journal_mode = WAL;
		CREATE TABLE IF NOT EXISTS airports (
			ident TEXT PRIMARY KEY,
			our_id INTEGER,
			type TEXT,
			name TEXT,
			latitude_deg REAL,
			longitude_deg REAL,
			elevation_ft INTEGER,
			continent TEXT,
			iso_country TEXT,
			iso_region TEXT,
			municipality TEXT,
			gps_code TEXT,
			iata_code TEXT,
			local_code TEXT
		);
		CREATE TABLE IF NOT EXISTS visits (
			airport_ident TEXT PRIMARY KEY,
			visited_at TEXT,
			note TEXT,
			FOREIGN KEY (airport_ident) REFERENCES airports(ident) ON DELETE CASCADE
		);
		CREATE INDEX IF NOT EXISTS idx_airports_country ON airports(iso_country);
		CREATE INDEX IF NOT EXISTS idx_airports_type ON airports(type);
		CREATE INDEX IF NOT EXISTS idx_airports_municipality ON airports(municipality);
	`);
}

export function getDb(): Database.Database {
	if (dbInstance) return dbInstance;
	const preferred = getPreferredDatabaseFilePath();
	const filePath = ensureDirectoryExistsOrFallback(preferred);
	try {
		dbInstance = new Database(filePath);
	} catch {
		// Fallback to in-memory if opening fails
		dbInstance = new Database(":memory:");
	}
	migrate(dbInstance);
	return dbInstance;
}

export type QueryOptions = {
	q?: string;
	country?: string;
	type?: string;
	visitedOnly?: boolean;
	limit?: number;
	offset?: number;
};

export function bulkUpsertAirports(rows: Airport[]) {
	const db = getDb();
	const upsert = db.prepare(
		`INSERT INTO airports (
			ident, our_id, type, name, latitude_deg, longitude_deg, elevation_ft, continent, iso_country, iso_region, municipality, gps_code, iata_code, local_code
		) VALUES (
			@ident, @our_id, @type, @name, @latitude_deg, @longitude_deg, @elevation_ft, @continent, @iso_country, @iso_region, @municipality, @gps_code, @iata_code, @local_code
		) ON CONFLICT(ident) DO UPDATE SET
			our_id=excluded.our_id,
			type=excluded.type,
			name=excluded.name,
			latitude_deg=excluded.latitude_deg,
			longitude_deg=excluded.longitude_deg,
			elevation_ft=excluded.elevation_ft,
			continent=excluded.continent,
			iso_country=excluded.iso_country,
			iso_region=excluded.iso_region,
			municipality=excluded.municipality,
			gps_code=excluded.gps_code,
			iata_code=excluded.iata_code,
			local_code=excluded.local_code`
	);

	const transaction = db.transaction((items: Airport[]) => {
		for (const item of items) {
			upsert.run(item);
		}
	});

	transaction(rows);
}

export function queryAirports(options: QueryOptions) {
	const db = getDb();
	const limit = Math.max(0, Math.min(500, options.limit ?? 50));
	const offset = Math.max(0, options.offset ?? 0);

	const where: string[] = [];
	const params: Record<string, unknown> = {};

	if (options.q && options.q.trim().length > 0) {
		where.push(`(a.name LIKE @q OR a.ident LIKE @q OR a.iata_code LIKE @q OR a.municipality LIKE @q)`);
		params.q = `%${options.q.trim()}%`;
	}
	if (options.country && options.country.trim().length > 0) {
		where.push(`a.iso_country = @country`);
		params.country = options.country.trim().toUpperCase();
	}
	if (options.type && options.type.trim().length > 0) {
		where.push(`a.type = @type`);
		params.type = options.type.trim();
	}
	if (options.visitedOnly) {
		where.push(`v.airport_ident IS NOT NULL`);
	}

	const whereSql = where.length > 0 ? `WHERE ${where.join(" AND ")}` : "";

	const sql = `
		SELECT a.ident, a.our_id, a.type, a.name, a.latitude_deg, a.longitude_deg, a.elevation_ft, a.continent, a.iso_country, a.iso_region, a.municipality, a.gps_code, a.iata_code, a.local_code,
			CASE WHEN v.airport_ident IS NOT NULL THEN 1 ELSE 0 END AS visited,
			v.visited_at as visited_at
		FROM airports a
		LEFT JOIN visits v ON v.airport_ident = a.ident
		${whereSql}
		ORDER BY visited DESC, a.iso_country, a.municipality, a.name
		LIMIT @limit OFFSET @offset
	`;

	const countSql = `
		SELECT COUNT(1) as count
		FROM airports a
		LEFT JOIN visits v ON v.airport_ident = a.ident
		${whereSql}
	`;

	const stmt = db.prepare(sql);
	const countStmt = db.prepare(countSql);
	const rows = stmt.all({ ...params, limit, offset }) as AirportRow[];
	const totalRow = countStmt.get(params) as { count: number } | undefined;
	return { items: rows, total: totalRow?.count ?? 0, limit, offset };
}

export function setVisited(ident: string, visited?: boolean) {
	const db = getDb();
	const isCurrentlyVisited = !!db.prepare(`SELECT 1 FROM visits WHERE airport_ident = ?`).get(ident);
	let newVisited = isCurrentlyVisited;
	if (visited === undefined) {
		newVisited = !isCurrentlyVisited;
	} else {
		newVisited = !!visited;
	}
	if (newVisited) {
		db.prepare(`INSERT OR REPLACE INTO visits (airport_ident, visited_at) VALUES (?, ? )`).run(ident, new Date().toISOString());
	} else {
		db.prepare(`DELETE FROM visits WHERE airport_ident = ?`).run(ident);
	}
	return { ident, visited: newVisited };
}

export function getStats() {
	const db = getDb();
	const total = (db.prepare(`SELECT COUNT(1) as c FROM airports`).get() as { c: number } | undefined)?.c ?? 0;
	const visited = (db.prepare(`SELECT COUNT(1) as c FROM visits`).get() as { c: number } | undefined)?.c ?? 0;
	const topCountries = db
		.prepare(
			`SELECT a.iso_country as country, COUNT(1) as visited_count
			FROM visits v
			JOIN airports a ON a.ident = v.airport_ident
			GROUP BY a.iso_country
			ORDER BY visited_count DESC
			LIMIT 10`
		)
		.all() as { country: string; visited_count: number }[];
	return { total, visited, topCountries };
}

