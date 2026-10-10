import { handlers } from "@/auth";
import { authConfigured, cloudflareAdmin } from "@/lib/backend/config";
import type { NextRequest } from "next/server";

export const runtime = "nodejs";
function unavailable() {
	return Response.json(
		{
			error:
				"GitHub sign-in is not configured. See docs/cloudflare-backend.md.",
		},
		{ status: 503, headers: { "Cache-Control": "no-store" } },
	);
}
export const GET = (request: NextRequest) =>
	cloudflareAdmin() && authConfigured() ? handlers.GET(request) : unavailable();
export const POST = (request: NextRequest) =>
	cloudflareAdmin() && authConfigured()
		? handlers.POST(request)
		: unavailable();
