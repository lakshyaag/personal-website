import { setVisited } from "@/lib/airports/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ ident: string }> },
) {
	const { ident } = await params;
	try {
		let visited: boolean | undefined = undefined;
		try {
			const body = await request.json();
			if (typeof body?.visited === "boolean") visited = body.visited;
		} catch {}
		const result = setVisited(ident, visited);
		return Response.json({ ok: true, ...result });
	} catch (err) {
		return new Response(
			JSON.stringify({ ok: false, error: (err as Error).message }),
			{ status: 500, headers: { "content-type": "application/json" } }
		);
	}
}

