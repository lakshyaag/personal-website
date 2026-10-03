import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { createMiddlewareSupabaseClient } from "@/lib/supabase-server";

// Routes that don't require authentication even for POST/PUT/DELETE
const PUBLIC_API_PREFIXES = ["/api/webhooks/"];
const PUBLIC_API_ROUTES = ["/api/recommend"];

export async function proxy(req: NextRequest) {
	const { pathname } = req.nextUrl;

	// Handle logout
	if (pathname === "/api/logout") {
		const response = NextResponse.redirect(new URL("/admin/login", req.url));
		response.cookies.delete("sb-access-token");
		response.cookies.delete("sb-refresh-token");
		return response;
	}

	// Allow login page without auth
	if (pathname === "/admin/login") {
		return NextResponse.next();
	}

	// Check if path needs authentication
	const isPublicApiRoute =
		PUBLIC_API_ROUTES.includes(pathname) ||
		PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));

	const needsAuth =
		pathname.startsWith("/admin") ||
		(pathname.startsWith("/api") &&
			!isPublicApiRoute &&
			(req.method === "POST" ||
				req.method === "PUT" ||
				req.method === "DELETE"));

	if (!needsAuth) {
		return NextResponse.next();
	}

	// Create response to pass to Supabase client
	const response = NextResponse.next();

	// Create Supabase client for middleware
	const supabase = createMiddlewareSupabaseClient(req, response);

	// Check authentication
	const {
		data: { session },
	} = await supabase.auth.getSession();

	// If no session, redirect to login for /admin pages or return 401 for API routes
	if (!session) {
		if (pathname.startsWith("/admin")) {
			const redirectUrl = new URL("/admin/login", req.url);
			redirectUrl.searchParams.set("redirectTo", pathname);
			return NextResponse.redirect(redirectUrl);
		}

		// API routes return 401
		return new NextResponse("Unauthorized", {
			status: 401,
			headers: {
				"Content-Type": "application/json",
			},
		});
	}

	// User is authenticated, continue
	return response;
}

export const config = {
	matcher: ["/admin/:path*", "/api/:path*"],
};
