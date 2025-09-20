import fs from "node:fs";
import path from "node:path";
import { parse } from "csv-parse/sync";

export const OUR_AIRPORTS_URL = "https://ourairports.com/data/airports.csv";

export type AirportCsvRow = {
	id?: string;
	ident?: string;
	type?: string;
	name?: string;
	latitude_deg?: string;
	longitude_deg?: string;
	elevation_ft?: string;
	continent?: string;
	iso_country?: string;
	iso_region?: string;
	municipality?: string;
	scheduled_service?: string;
	gps_code?: string;
	iata_code?: string;
	local_code?: string;
	home_link?: string;
	wikipedia_link?: string;
	keywords?: string;
};

export async function fetchAirportsCsvText(sourceUrl?: string): Promise<string> {
	const url = sourceUrl && sourceUrl.trim().length > 0 ? sourceUrl : OUR_AIRPORTS_URL;
	const res = await fetch(url, { cache: "no-store" });
	if (!res.ok) {
		throw new Error(`Failed to fetch CSV: ${res.status} ${res.statusText}`);
	}
	return await res.text();
}

export function parseAirportsCsv(csvText: string): AirportCsvRow[] {
	const records = parse(csvText, { columns: true, skip_empty_lines: true }) as AirportCsvRow[];
	return records;
}

export async function downloadAirportsCsvToTmp(sourceUrl?: string): Promise<{ path: string; bytes: number; columns: string[]; sampleRows: AirportCsvRow[] }>
{
	const csvText = await fetchAirportsCsvText(sourceUrl);
	const tmpDir = "/tmp";
	try {
		if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir, { recursive: true });
	} catch {}
	const filePath = path.join(tmpDir, "airports.csv");
	const buf = Buffer.from(csvText, "utf-8");
	try {
		fs.writeFileSync(filePath, buf);
	} catch {}
	const rows = parseAirportsCsv(csvText);
	const columns = rows.length > 0 ? Object.keys(rows[0]!) : [];
	return { path: filePath, bytes: buf.length, columns, sampleRows: rows.slice(0, 5) };
}

