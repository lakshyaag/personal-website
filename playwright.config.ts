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
			command: `bunx wrangler d1 migrations apply personal-journal-local --local --config cloudflare/test/wrangler.jsonc --persist-to .wrangler/e2e && bunx wrangler dev --config cloudflare/test/wrangler.jsonc --persist-to .wrangler/e2e --port 8788 --inspector-port 9231 --var WORKER_API_SECRET:${WORKER_SECRET}`,
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
				JOURNAL_BACKEND: "cloudflare",
				AUTH_SECRET,
				ADMIN_GITHUB_ID: OWNER_ID,
				AUTH_GITHUB_ID: "browser-test-client",
				AUTH_GITHUB_SECRET: "browser-test-oauth-secret",
				AUTH_URL: BASE_URL,
				AUTH_TRUST_HOST: "true",
				CLOUDFLARE_WORKER_URL: "http://localhost:8788",
				CLOUDFLARE_WORKER_SECRET: WORKER_SECRET,
				LOCAL_WORKER_UPLOADS: "true",
				NEXT_PUBLIC_SUPABASE_URL: "https://unused-migration-source.supabase.co",
				NEXT_PUBLIC_SUPABASE_ANON_KEY: "browser-test-anon-key",
				SUPABASE_SERVICE_ROLE_KEY: "browser-test-service-role-key",
			},
		},
	],
});
