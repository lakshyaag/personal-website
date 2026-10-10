import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
	resolve: {
		alias: {
			"@": path.resolve(import.meta.dirname),
			"server-only": path.resolve(import.meta.dirname, "tests/server-only.ts"),
		},
	},
	test: {
		include: ["tests/unit/**/*.test.ts"],
		environment: "node",
		restoreMocks: true,
	},
});
