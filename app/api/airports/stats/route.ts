import { fetchAirportsCsvText, parseAirportsCsv } from "@/lib/airports/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
	const csvText = await fetchAirportsCsvText();
	const rows = parseAirportsCsv(csvText);
	return Response.json({ total: rows.length, visited: 0, topCountries: [] });
}

