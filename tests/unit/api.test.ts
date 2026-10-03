import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("../../auth", () => ({ auth: vi.fn() }));
import { GET, POST } from "../../app/api/migration/journal/route";
import { auth } from "../../auth";
import { requireOwner } from "../../lib/migration/api";
import { workerRequest } from "../../lib/migration/worker-client";

const secret = "local-test-secret-at-least-32-characters-long";
function configured() {
	vi.stubEnv("JOURNAL_BACKEND", "cloudflare");
	vi.stubEnv("AUTH_SECRET", secret);
	vi.stubEnv("AUTH_GITHUB_ID", "test-oauth-client");
	vi.stubEnv("AUTH_GITHUB_SECRET", "test-oauth-secret");
	vi.stubEnv("ADMIN_GITHUB_ID", "123");
	vi.stubEnv("AUTH_URL", "https://website.test");
	vi.stubEnv("CLOUDFLARE_WORKER_URL", "https://worker.test");
	vi.stubEnv("CLOUDFLARE_WORKER_SECRET", secret);
}
afterEach(() => {
	vi.unstubAllEnvs();
	vi.unstubAllGlobals();
	vi.resetAllMocks();
});
describe("Next.js private API", () => {
	it("rejects anonymous reads without contacting the backend", async () => {
		configured();
		vi.mocked(auth).mockResolvedValue(null as never);
		const fetch = vi.fn();
		vi.stubGlobal("fetch", fetch);
		expect(
			(await GET(new Request("https://website.test/api/migration/journal")))
				.status,
		).toBe(401);
		expect(fetch).not.toHaveBeenCalled();
	});
	it("rejects a session from another GitHub ID", async () => {
		configured();
		vi.mocked(auth).mockResolvedValue({ user: { id: "456" } } as never);
		await expect(requireOwner()).rejects.toMatchObject({ status: 401 });
	});
	it("fails closed on placeholder config", async () => {
		configured();
		vi.stubEnv("AUTH_SECRET", "REPLACE_WITH_A_LONG_RANDOM_AUTH_SECRET");
		expect(
			(await GET(new Request("https://website.test/api/migration/journal")))
				.status,
		).toBe(503);
	});
	it("requires same-origin mutations even for an authenticated owner", async () => {
		configured();
		vi.mocked(auth).mockResolvedValue({ user: { id: "123" } } as never);
		for (const origin of [undefined, "https://evil.test"]) {
			const response = await POST(
				new Request("https://website.test/api/migration/journal", {
					method: "POST",
					headers: origin ? { Origin: origin } : {},
				}),
			);
			expect(response.status).toBe(403);
		}
	});
	it("rejects bad inputs before sending them to the Worker", async () => {
		configured();
		vi.mocked(auth).mockResolvedValue({ user: { id: "123" } } as never);
		const fetch = vi.fn();
		vi.stubGlobal("fetch", fetch);
		const response = await POST(
			new Request("https://website.test/api/migration/journal", {
				method: "POST",
				headers: {
					Origin: "https://website.test",
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ sql: "DROP TABLE journal_entries" }),
			}),
		);
		expect(response.status).toBe(400);
		expect(fetch).not.toHaveBeenCalled();
	});
});
describe("Server-only Worker client", () => {
	it("sends credentials only to the configured HTTPS Worker, and never follows redirects", async () => {
		configured();
		const fetch = vi.fn().mockResolvedValue(Response.json({ ok: true }));
		vi.stubGlobal("fetch", fetch);
		await workerRequest("/v1/health");
		const [url, options] = fetch.mock.calls[0];
		expect(String(url)).toBe("https://worker.test/v1/health");
		expect(options.headers.get("Authorization")).toBe(`Bearer ${secret}`);
		expect(options.redirect).toBe("error");
		expect(options.cache).toBe("no-store");
	});
	it("rejects production HTTP backends and short credentials", async () => {
		configured();
		vi.stubEnv("NODE_ENV", "production");
		vi.stubEnv("CLOUDFLARE_WORKER_URL", "http://localhost:8787");
		await expect(workerRequest("/v1/health")).rejects.toMatchObject({
			status: 503,
		});
		vi.stubEnv("CLOUDFLARE_WORKER_SECRET", "dummy");
		await expect(workerRequest("/v1/health")).rejects.toMatchObject({
			status: 503,
		});
	});
	it("preserves conflicts and reports timeouts as retryable backend failures", async () => {
		configured();
		vi.stubGlobal(
			"fetch",
			vi
				.fn()
				.mockResolvedValue(
					Response.json(
						{ error: "Entry changed", code: "CONFLICT" },
						{ status: 409 },
					),
				),
		);
		await expect(workerRequest("/v1/journal")).rejects.toMatchObject({
			status: 409,
			code: "CONFLICT",
		});
		vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("timeout")));
		await expect(workerRequest("/v1/health")).rejects.toMatchObject({
			status: 502,
		});
	});
});
