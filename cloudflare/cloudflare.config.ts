import { bindings, defineConfig, triggers } from "cf/config";

// One shared backend/database/private photo bucket for all admin features.
// Journal is the first set of tables/routes, not a separate database boundary.
export default defineConfig((ctx) => {
	if (ctx.mode && ctx.mode !== "production" && ctx.mode !== "development") {
		throw new Error("Use production or development mode");
	}
	const production = ctx.mode === "production";
	const prefix = production
		? "personal-website-production"
		: "personal-website-local";
	return {
		accountId: "fcf26aca1a63b47d0f65379ffef4c0f0",
		worker: {
			name: production ? "personal-website-backend" : "personal-website-local",
			entrypoint: "src/index.ts",
			compatibilityDate: "2026-03-01",
			compatibilityFlags: ["nodejs_compat"],
			workersDev: true,
			observability: { enabled: true },
			env: {
				DB: bindings.d1({
					name: prefix,
					id: production
						? "6302f028-7188-46d5-8077-8a7fbfd0cc95"
						: "2a0807fc-e848-424d-af30-e028e831ac8d",
				}),
				PHOTOS: bindings.r2({ name: `${prefix}-private` }),
				WORKER_API_SECRET: bindings.secret(),
				LOCAL_UPLOADS: bindings.text(production ? "false" : "true"),
			},
			triggers: [
				triggers.scheduled({ schedule: "*/10 * * * *" }),
			],
		},
	};
});
