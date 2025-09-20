import { queryAirports } from "@/lib/airports/db";

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

	const result = queryAirports({ q, country, type, visitedOnly, limit, offset });
	return Response.json(result);
}

