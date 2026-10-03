import path from "node:path";
import {
	defineWorkersConfig,
	readD1Migrations,
} from "@cloudflare/vitest-pool-workers/config";

export default defineWorkersConfig(async () => ({
	test: {
		include: ["cloudflare/test/**/*.test.ts"],
		poolOptions: {
			workers: {
				wrangler: {
					configPath: path.resolve(import.meta.dirname, "test/wrangler.jsonc"),
				},
				miniflare: {
					bindings: {
						WORKER_API_SECRET:
							"local-worker-test-secret-at-least-32-characters",
						LOCAL_UPLOADS: "true",
						TEST_MIGRATIONS: await readD1Migrations(
							path.resolve(import.meta.dirname, "migrations"),
						),
					},
				},
			},
		},
	},
}));
