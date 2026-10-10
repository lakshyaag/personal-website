import { auth } from "@/auth";
import { authConfigured, ownerAllowed } from "@/lib/backend/config";
import { type NextRequest, NextResponse } from "next/server";

/** Admin pages require the owner's session. API routes check it themselves (privateRoute). */
export async function proxy(request: NextRequest) {
	const path = request.nextUrl.pathname;
	if (path === "/admin/login") return NextResponse.next();
	const session = authConfigured() ? await auth() : null;
	if (!ownerAllowed(session?.user?.id)) {
		const url = new URL("/admin/login", request.url);
		url.searchParams.set("redirectTo", path + request.nextUrl.search);
		return NextResponse.redirect(url);
	}
	const response = NextResponse.next();
	response.headers.set("Cache-Control", "private, no-store");
	return response;
}
export const config = { matcher: ["/admin/:path*"] };
