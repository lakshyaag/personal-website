import "server-only";
import { auth } from "@/auth";
import { z } from "zod";
import { authConfigured, cloudflareAdmin, ownerAllowed } from "./config";
import { BackendError } from "./worker";

export async function requireOwner(request?: Request) {
	if (!cloudflareAdmin())
		throw new BackendError(
			404,
			"Cloudflare admin backend is not enabled",
			"DISABLED",
		);
	if (!authConfigured())
		throw new BackendError(
			503,
			"GitHub sign-in is not configured. See docs/cloudflare-backend.md.",
			"CONFIGURATION",
		);
	const session = await auth();
	if (!ownerAllowed(session?.user?.id))
		throw new BackendError(
			401,
			"Sign in with your approved GitHub account",
			"UNAUTHORIZED",
		);
	if (request && !["GET", "HEAD"].includes(request.method)) {
		const origin = request.headers.get("origin");
		// Auth.js handles OAuth CSRF. Our own mutations require a same-origin browser request.
		const configuredOrigin = process.env.AUTH_URL
			? new URL(process.env.AUTH_URL).origin
			: new URL(request.url).origin;
		if (
			!origin ||
			origin !== configuredOrigin ||
			request.headers.get("sec-fetch-site") === "cross-site"
		)
			throw new BackendError(403, "Cross-origin request rejected", "ORIGIN");
	}
}
export async function readJson(request: Request) {
	if (!request.headers.get("content-type")?.startsWith("application/json"))
		throw new BackendError(415, "Use application/json");
	if (!request.body) throw new BackendError(400, "Missing JSON body");
	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		size += value.length;
		if (size > 512_000) {
			await reader.cancel();
			throw new BackendError(413, "Request is too large");
		}
		chunks.push(value);
	}
	const bytes = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		bytes.set(chunk, offset);
		offset += chunk.length;
	}
	try {
		return JSON.parse(new TextDecoder().decode(bytes));
	} catch {
		throw new BackendError(400, "Invalid JSON");
	}
}
export function privateJson(data: unknown, status = 200) {
	return Response.json(data, {
		status,
		headers: {
			"Cache-Control": "private, no-store",
			"X-Content-Type-Options": "nosniff",
		},
	});
}
export function apiError(error: unknown) {
	if (error instanceof z.ZodError)
		return privateJson(
			{
				error: error.issues.map((issue) => issue.message).join("; "),
				code: "VALIDATION",
			},
			400,
		);
	if (error instanceof BackendError)
		return privateJson(
			{ error: error.message, code: error.code, requestId: error.requestId },
			error.status,
		);
	const requestId = crypto.randomUUID();
	console.error(JSON.stringify({ code: "ADMIN_API_FAILURE", requestId }));
	return privateJson(
		{ error: "Request failed. Retry shortly.", requestId },
		500,
	);
}
export async function privateRoute(
	request: Request,
	action: () => Promise<Response>,
) {
	try {
		await requireOwner(request);
		return await action();
	} catch (error) {
		return apiError(error);
	}
}
