import { fetchAirportsCsvText, parseAirportsCsv } from "@/lib/airports/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const q = searchParams.get("q") ?? undefined;
	const country = searchParams.get("country") ?? undefined;
	const type = searchParams.get("type") ?? undefined;
	const limit = Number(searchParams.get("limit") ?? "50");
	const offset = Number(searchParams.get("offset") ?? "0");

	// Fetch and filter CSV directly; no DB persistence
	const csvText = await fetchAirportsCsvText();
	const rows = parseAirportsCsv(csvText);

	const filtered = rows.filter((r) => {
		if (q && q.trim()) {
			const needle = q.trim().toLowerCase();
			const hay = [r.name, r.ident, r.iata_code, r.municipality, r.gps_code, r.local_code]
				.filter(Boolean)
				.map((s) => String(s).toLowerCase());
			if (!hay.some((s) => (s as string).includes(needle))) return false;
		}
		if (country && country.trim()) {
			if ((r.iso_country || "").toUpperCase() !== country.trim().toUpperCase()) return false;
		}
		if (type && type.trim()) {
			if ((r.type || "") !== type.trim()) return false;
		}
		return true;
	});

	const total = filtered.length;
	const items = filtered.slice(offset, offset + limit).map((r) => ({
		ident: r.ident || r.gps_code || r.local_code || "",
		our_id: r.id ? Number(r.id) : null,
		type: r.type || null,
		name: r.name || null,
		latitude_deg: r.latitude_deg ? Number(r.latitude_deg) : null,
		longitude_deg: r.longitude_deg ? Number(r.longitude_deg) : null,
		elevation_ft: r.elevation_ft ? Number(r.elevation_ft) : null,
		continent: r.continent || null,
		iso_country: r.iso_country ? r.iso_country.toUpperCase() : null,
		iso_region: r.iso_region || null,
		municipality: r.municipality || null,
		gps_code: r.gps_code || null,
		iata_code: r.iata_code || null,
		local_code: r.local_code || null,
		visited: 0,
		visited_at: null,
	}));

	return Response.json({ items, total, limit, offset });
}

