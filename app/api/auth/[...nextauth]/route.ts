import { handlers } from "@/auth";
import { authConfigured, migrationEnabled } from "@/lib/migration/config";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
function unavailable() {
	return Response.json(
		{
			error:
				"GitHub sign-in is not configured. See docs/cloudflare-migration.md.",
		},
		{ status: 503, headers: { "Cache-Control": "no-store" } },
	);
}
export const GET = (request: NextRequest) =>
	migrationEnabled() && authConfigured()
		? handlers.GET(request)
		: unavailable();
export const POST = (request: NextRequest) =>
	migrationEnabled() && authConfigured()
		? handlers.POST(request)
		: unavailable();
