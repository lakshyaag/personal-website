import { downloadAirportsCsvToTmp } from "@/lib/airports/csv";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(request: Request) {
	try {
		let url: string | undefined = undefined;
		try {
			const body = await request.json();
			url = body?.url as string | undefined;
		} catch {}
		const result = await downloadAirportsCsvToTmp(url);
		return Response.json({ ok: true, ...result });
	} catch (err) {
		return new Response(
			JSON.stringify({ ok: false, error: (err as Error).message }),
			{ status: 500, headers: { "content-type": "application/json" } }
		);
	}
}

