import "server-only";
import { validSecret } from "./config";

export class BackendError extends Error {
	constructor(
		public status: number,
		message: string,
		public code = "BACKEND",
		public requestId?: string,
	) {
		super(message);
	}
}
export async function workerRequest(
	path: string,
	init: RequestInit = {},
): Promise<Response> {
	const base = process.env.CLOUDFLARE_WORKER_URL;
	const secret = process.env.CLOUDFLARE_WORKER_SECRET;
	if (!base || !validSecret(secret))
		throw new BackendError(
			503,
			"Cloudflare backend is not configured. See docs/cloudflare-backend.md.",
			"CONFIGURATION",
		);
	const url = new URL(base);
	if (
		url.protocol !== "https:" &&
		!(
			process.env.NODE_ENV !== "production" &&
			url.protocol === "http:" &&
			["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
		)
	)
		throw new BackendError(503, "Worker URL must use HTTPS", "CONFIGURATION");
	if (!path.startsWith("/v1/"))
		throw new BackendError(500, "Invalid backend path");
	const headers = new Headers(init.headers);
	headers.set("Authorization", `Bearer ${secret}`);
	if (typeof init.body === "string")
		headers.set("Content-Type", "application/json");
	let response: Response;
	try {
		response = await fetch(new URL(path, url), {
			...init,
			headers,
			cache: "no-store",
			redirect: "error",
			signal: AbortSignal.timeout(30_000),
			...(init.body instanceof ReadableStream ? { duplex: "half" } : {}),
		});
	} catch {
		throw new BackendError(
			502,
			"Cloudflare is unavailable. Retry shortly.",
			"UNAVAILABLE",
		);
	}
	if (!response.ok) {
		const data = (await response.json().catch(() => ({}))) as {
			error?: string;
			code?: string;
			requestId?: string;
		};
		// Don't expose service authentication/configuration details as a user sign-in failure.
		throw new BackendError(
			response.status === 401 ? 502 : response.status,
			data.error ?? "Backend request failed",
			data.code,
			data.requestId,
		);
	}
	return response;
}
export async function workerJson<T>(
	path: string,
	init?: RequestInit,
): Promise<T> {
	return (await workerRequest(path, init)).json() as Promise<T>;
}
