import { getDb, queryAirports } from "@/lib/airports/db";
import { importOurAirportsCsv } from "@/lib/airports/importer";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(request: Request) {
	const { searchParams } = new URL(request.url);
	const q = searchParams.get("q") ?? undefined;
	const country = searchParams.get("country") ?? undefined;
	const type = searchParams.get("type") ?? undefined;
	const visitedOnly = (searchParams.get("visitedOnly") ?? "").toLowerCase() === "true";
	const limit = Number(searchParams.get("limit") ?? "50");
	const offset = Number(searchParams.get("offset") ?? "0");

	// Auto-seed when the database is empty (useful for in-memory/serverless)
	try {
		const db = getDb();
		const row = db.prepare(`SELECT COUNT(1) as c FROM airports`).get() as { c: number } | undefined;
		if (!row || row.c === 0) {
			await importOurAirportsCsv();
		}
	} catch {}

	const result = queryAirports({ q, country, type, visitedOnly, limit, offset });
	return Response.json(result);
}

