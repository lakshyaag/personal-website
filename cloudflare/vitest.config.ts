import path from "node:path";
import {
	defineWorkersConfig,
	readD1Migrations,
} from "@cloudflare/vitest-pool-workers/config";

// Isolated in-memory bindings mirroring cloudflare.config.ts; never touches real resources.
export default defineWorkersConfig(async () => ({
	test: {
		include: ["cloudflare/test/**/*.test.ts"],
		poolOptions: {
			workers: {
				main: path.resolve(import.meta.dirname, "src/index.ts"),
				miniflare: {
					compatibilityDate: "2026-03-01",
					compatibilityFlags: ["nodejs_compat"],
					d1Databases: { DB: "personal-website-test" },
					r2Buckets: { PHOTOS: "personal-website-test-private" },
					queueProducers: { ANALYSIS_QUEUE: "personal-website-test-analysis" },
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
