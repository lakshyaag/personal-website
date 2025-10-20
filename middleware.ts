import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(req: NextRequest) {
	const { pathname } = req.nextUrl;

	// Check if path needs authentication
	const needsAuth =
		pathname.startsWith("/admin") ||
		(pathname.startsWith("/api") &&
			(req.method === "POST" ||
				req.method === "PUT" ||
				req.method === "DELETE"));

	if (!needsAuth) {
		return NextResponse.next();
	}

	// Get authorization header
	const authHeader = req.headers.get("authorization") || "";
	const [scheme, encoded] = authHeader.split(" ");

	// Check Basic Auth
	if (scheme !== "Basic" || !encoded) {
		return unauthorized();
	}

	try {
		const decoded = atob(encoded);
		const [username, password] = decoded.split(":");

		const validUsername = process.env.ADMIN_USER;
		const validPassword = process.env.ADMIN_PASS;

		if (
			username === validUsername &&
			password === validPassword &&
			validUsername &&
			validPassword
		) {
			return NextResponse.next();
		}

		return unauthorized();
	} catch {
		return unauthorized();
	}
}

function unauthorized() {
	return new NextResponse("Unauthorized", {
		status: 401,
		headers: {
			"WWW-Authenticate": 'Basic realm="Admin Area"',
		},
	});
}

export const config = {
	matcher: ["/admin/:path*", "/api/:path*"],
};
