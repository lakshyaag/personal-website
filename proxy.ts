import { auth } from "@/auth";
import {
	authConfigured,
	cloudflareAdmin,
	ownerAllowed,
} from "@/lib/backend/config";
import { proxy as legacyProxy } from "@/lib/legacy-proxy";
import { type NextRequest, NextResponse } from "next/server";

export async function proxy(request: NextRequest) {
	if (!cloudflareAdmin()) {
		if (request.nextUrl.pathname.startsWith("/api/auth/"))
			return NextResponse.next();
		return legacyProxy(request);
	}
	const path = request.nextUrl.pathname;
	if (path.startsWith("/api/auth/") || path.startsWith("/api/admin/"))
		return NextResponse.next();
	if (path === "/admin/login") return NextResponse.next();
	if (path === "/api/logout")
		return NextResponse.json(
			{ error: "Use the sign-out button" },
			{ status: 405 },
		);
	if (path.startsWith("/admin")) {
		const session = authConfigured() ? await auth() : null;
		if (!ownerAllowed(session?.user?.id)) {
			const url = new URL("/admin/login", request.url);
			url.searchParams.set("redirectTo", path + request.nextUrl.search);
			return NextResponse.redirect(url);
		}
		// Unmigrated admin features must never silently write to Supabase. Fits and the AI
		// config page were dropped rather than migrated.
		if (
			![
				"/admin",
				"/admin/journal",
				"/admin/photos",
				"/admin/food",
				"/admin/workouts",
				"/admin/workouts/dashboard",
				"/admin/airports",
				"/admin/books",
			].includes(path)
		)
			return NextResponse.redirect(new URL("/admin", request.url));
		const response = NextResponse.next();
		response.headers.set("Cache-Control", "private, no-store");
		return response;
	}
	// Public gallery/teaser, served from Cloudflare by the route itself.
	if (
		path === "/api/photos" &&
		request.method === "GET" &&
		request.nextUrl.searchParams.get("admin") !== "true"
	)
		return NextResponse.next();
	// Resolves public photo URLs only (airport visit captions), so it is safe anonymously.
	if (path === "/api/photos/resolve" && request.method === "POST")
		return NextResponse.next();
	const legacyPrivate = [
		"/api/journal",
		"/api/food",
		"/api/fits",
		"/api/workouts",
		"/api/photos",
		"/api/ai",
	];
	if (
		legacyPrivate.some(
			(prefix) => path === prefix || path.startsWith(`${prefix}/`),
		)
	) {
		return NextResponse.json(
			{
				error: "This API has not moved to the Cloudflare admin backend yet.",
			},
			{ status: 410, headers: { "Cache-Control": "no-store" } },
		);
	}
	const publicSubmission =
		path === "/api/recommend" && request.method === "POST";
	const webhook = path.startsWith("/api/webhooks/");
	if (
		!["GET", "HEAD", "OPTIONS"].includes(request.method) &&
		!publicSubmission &&
		!webhook
	) {
		return NextResponse.json(
			{ error: "This feature has not been migrated" },
			{ status: 503 },
		);
	}
	return NextResponse.next();
}
export const config = { matcher: ["/admin/:path*", "/api/:path*"] };
