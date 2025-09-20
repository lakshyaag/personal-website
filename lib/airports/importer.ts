import { parse } from "csv-parse/sync";
import { bulkUpsertAirports, type Airport } from "@/lib/airports/db";

const DEFAULT_URL = "https://ourairports.com/data/airports.csv";

export async function importOurAirportsCsv(sourceUrl?: string) {
	const url = sourceUrl && sourceUrl.trim().length > 0 ? sourceUrl : DEFAULT_URL;
	const res = await fetch(url, { cache: "no-store" });
	if (!res.ok) {
		throw new Error(`Failed to fetch OurAirports CSV: ${res.status} ${res.statusText}`);
	}
	const csv = await res.text();
	const records = parse(csv, { columns: true, skip_empty_lines: true }) as Record<string, string>[];

	// Map and coerce types
	const airports: Airport[] = records.map((r) => ({
		ident: (r.ident || r.gps_code || r.local_code || r.iata_code || "").trim(),
		our_id: r.id ? Number(r.id) : null,
		type: r.type ? String(r.type) : null,
		name: r.name ? String(r.name) : null,
		latitude_deg: r.latitude_deg ? Number(r.latitude_deg) : null,
		longitude_deg: r.longitude_deg ? Number(r.longitude_deg) : null,
		elevation_ft: r.elevation_ft ? Number(r.elevation_ft) : null,
		continent: r.continent ? String(r.continent) : null,
		iso_country: r.iso_country ? String(r.iso_country).toUpperCase() : null,
		iso_region: r.iso_region ? String(r.iso_region) : null,
		municipality: r.municipality ? String(r.municipality) : null,
		gps_code: r.gps_code ? String(r.gps_code) : null,
		iata_code: r.iata_code ? String(r.iata_code) : null,
		local_code: r.local_code ? String(r.local_code) : null,
	}));

	// Filter out records without ident
	const filtered = airports.filter((a) => a.ident && a.ident.length > 0);

	bulkUpsertAirports(filtered);
	return { imported: filtered.length };
}

