import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");

async function parseCSV(filePath) {
	const content = await fs.readFile(filePath, "utf8");
	const lines = content.split("\n");
	const headers = lines[0].split(",").map((h) => h.trim().replace(/"/g, ""));

	const rows = [];
	for (let i = 1; i < lines.length; i++) {
		const line = lines[i].trim();
		if (!line) continue;

		// Simple CSV parsing (handles quoted fields)
		const values = [];
		let current = "";
		let inQuotes = false;

		for (let j = 0; j < line.length; j++) {
			const char = line[j];
			if (char === '"') {
				inQuotes = !inQuotes;
			} else if (char === "," && !inQuotes) {
				values.push(current.trim());
				current = "";
			} else {
				current += char;
			}
		}
		values.push(current.trim());

		const obj = {};
		headers.forEach((header, idx) => {
			obj[header] = values[idx] || "";
		});
		rows.push(obj);
	}

	return rows;
}

async function generateAirportsData() {
	console.log("📖 Reading airports.csv...");
	const csvPath = path.join(rootDir, "data", "airports.csv");
	const airports = await parseCSV(csvPath);

	console.log(`✅ Parsed ${airports.length} airports`);

	// Filter for scheduled passenger service only
	const filtered = airports
		.filter((airport) => {
			const scheduledService = airport.scheduled_service?.toLowerCase();
			return (
				scheduledService === "yes" &&
				airport.latitude_deg &&
				airport.longitude_deg &&
				!Number.isNaN(Number.parseFloat(airport.latitude_deg)) &&
				!Number.isNaN(Number.parseFloat(airport.longitude_deg))
			);
		})
		.map((airport) => ({
			ident: airport.ident || airport.icao_code,
			iata_code: airport.iata_code || "",
			name: airport.name,
			lat: Number.parseFloat(airport.latitude_deg),
			lon: Number.parseFloat(airport.longitude_deg),
			continent: airport.contient || "",
			iso_country: airport.iso_country,
			iso_region: airport.iso_region || "",
			municipality: airport.municipality || "",
			elevation_ft: airport.elevation_ft || -1,
		}));

	console.log(`✅ Filtered to ${filtered.length} scheduled passenger airports`);

	// Create data directory if it doesn't exist
	const dataDir = path.join(rootDir, "data");
	await fs.mkdir(dataDir, { recursive: true });

	// Write JSON file
	const outputPath = path.join(dataDir, "airports.min.json");
	await fs.writeFile(outputPath, JSON.stringify(filtered, null, 0));

	console.log(`✅ Generated ${outputPath}`);
	console.log(`📊 File size: ${((await fs.stat(outputPath)).size / 1024).toFixed(2)} KB`);
}

generateAirportsData().catch(console.error);
