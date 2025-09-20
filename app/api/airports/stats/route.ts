import { getStats } from "@/lib/airports/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
	const stats = getStats();
	return Response.json(stats);
}

