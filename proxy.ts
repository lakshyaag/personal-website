import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Environment validation
if (!process.env.ADMIN_USER || !process.env.ADMIN_PASS) {
	throw new Error(
		"ADMIN_USER and ADMIN_PASS environment variables must be set"
	);
}

// In-memory rate limiting store (resets on deployment)
const failedAttempts = new Map<string, { count: number; timestamp: number }>();
const RATE_LIMIT_ATTEMPTS = 5;
const RATE_LIMIT_WINDOW = 15 * 60 * 1000; // 15 minutes

// Session store
const sessions = new Map<string, { createdAt: number }>();
const SESSION_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days
const SESSION_COOKIE_NAME = "admin_session";

function getClientIp(req: NextRequest): string {
	return (
		req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
		req.headers.get("x-real-ip") ||
		"unknown"
	);
}

function checkRateLimit(ip: string): boolean {
	const now = Date.now();
	const attempt = failedAttempts.get(ip);

	if (!attempt) {
		return true; // No previous attempts
	}

	// Check if rate limit window has expired
	if (now - attempt.timestamp > RATE_LIMIT_WINDOW) {
		failedAttempts.delete(ip);
		return true; // Window expired, allow
	}

	// Check if exceeded limit
	return attempt.count < RATE_LIMIT_ATTEMPTS;
}

function recordFailedAttempt(ip: string): void {
	const now = Date.now();
	const attempt = failedAttempts.get(ip);

	if (!attempt) {
		failedAttempts.set(ip, { count: 1, timestamp: now });
	} else {
		attempt.count += 1;
		attempt.timestamp = now;
	}
}

function clearFailedAttempts(ip: string): void {
	failedAttempts.delete(ip);
}

async function hashPassword(password: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(password);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function createSession(): string {
	const bytes = new Uint8Array(32);
	crypto.getRandomValues(bytes);
	const token = Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, "0"))
		.join("");
	sessions.set(token, { createdAt: Date.now() });
	return token;
}

function verifySession(token: string): boolean {
	const session = sessions.get(token);
	if (!session) {
		return false;
	}

	const now = Date.now();
	if (now - session.createdAt > SESSION_DURATION) {
		sessions.delete(token);
		return false;
	}

	return true;
}

export async function proxy(req: NextRequest) {
	const { pathname } = req.nextUrl;
	const clientIp = getClientIp(req);

	// Handle logout
	if (pathname === "/api/logout") {
		const response = NextResponse.json({ success: true });
		response.cookies.delete(SESSION_COOKIE_NAME);
		return response;
	}

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

	// Check for existing valid session
	const sessionToken = req.cookies.get(SESSION_COOKIE_NAME)?.value;
	if (sessionToken && verifySession(sessionToken)) {
		console.info(
			`[AUTH] Session valid for IP: ${clientIp} on ${pathname}`
		);
		return NextResponse.next();
	}

	// Check rate limit
	if (!checkRateLimit(clientIp)) {
		console.warn(
			`[AUTH] Rate limit exceeded for IP: ${clientIp} on ${pathname}`
		);
		return new NextResponse(
			"Too many authentication attempts. Try again later.",
			{
				status: 429,
				headers: {
					"Retry-After": "900", // 15 minutes
				},
			}
		);
	}

	// Get authorization header
	const authHeader = req.headers.get("authorization") || "";
	const [scheme, encoded] = authHeader.split(" ");

	// Check Basic Auth
	if (scheme !== "Basic" || !encoded) {
		// Missing auth header on first request is normal, just return 401
		// Browser will retry with credentials
		return unauthorized();
	}

	try {
		const decoded = atob(encoded);
		const [username, password] = decoded.split(":");

		const validUsername = process.env.ADMIN_USER;
		const validPassword = process.env.ADMIN_PASS;

		// Ensure env vars exist
		if (!validUsername || !validPassword) {
			console.error(
				"[AUTH] Missing ADMIN_USER or ADMIN_PASS environment variables"
			);
			return unauthorized();
		}

		// Compare incoming password hash to stored hash
		const incomingHash = await hashPassword(password);
		const credentialsValid =
			username === validUsername && incomingHash === validPassword;

		if (credentialsValid) {
			clearFailedAttempts(clientIp);
			console.info(`[AUTH] Successful login from IP: ${clientIp}`);

			const response = NextResponse.next();
			const sessionToken = createSession();
			response.cookies.set(SESSION_COOKIE_NAME, sessionToken, {
				httpOnly: true,
				secure: true,
				sameSite: "strict",
				maxAge: Math.floor(SESSION_DURATION / 1000),
				path: "/",
			});
			return response;
		}

		recordFailedAttempt(clientIp);
		console.warn(
			`[AUTH] Failed login attempt from IP: ${clientIp} on ${pathname}`
		);
		return unauthorized();
	} catch (error) {
		recordFailedAttempt(clientIp);
		console.warn(
			`[AUTH] Error parsing auth header from IP: ${clientIp}:`,
			error
		);
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
