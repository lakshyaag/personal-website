import { defineConfig, devices } from "@playwright/test";
import {
	AUTH_SECRET,
	BASE_URL,
	OWNER_ID,
	WORKER_SECRET,
} from "./tests/e2e/env";

export default defineConfig({
	testDir: "./tests/e2e",
	fullyParallel: false,
	workers: 1,
	timeout: 90_000,
	expect: { timeout: 20_000 },
	use: {
		baseURL: BASE_URL,
		trace: "retain-on-failure",
		screenshot: "only-on-failure",
	},
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
	webServer: [
		{
			command: "bun tests/e2e/worker.ts",
			url: "http://localhost:8788/v1/health",
			ignoreHTTPSErrors: false,
			reuseExistingServer: false,
			timeout: 120_000,
		},
		{
			command: "bun run dev --port 3001",
			url: `${BASE_URL}/admin/login`,
			reuseExistingServer: false,
			timeout: 120_000,
			env: {
				NEXT_DIST_DIR: ".next-e2e",
				AUTH_SECRET,
				ADMIN_GITHUB_ID: OWNER_ID,
				AUTH_GITHUB_ID: "browser-test-client",
				AUTH_GITHUB_SECRET: "browser-test-oauth-secret",
				AUTH_URL: BASE_URL,
				AUTH_TRUST_HOST: "true",
				CLOUDFLARE_WORKER_URL: "http://localhost:8788",
				CLOUDFLARE_WORKER_SECRET: WORKER_SECRET,
				LOCAL_WORKER_UPLOADS: "true",
			},
		},
	],
});
