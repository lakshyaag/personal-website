// Serves the cf-built Worker for browser tests with fresh in-memory local bindings.
import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { Miniflare } from "miniflare";
import { WORKER_SECRET } from "./env";

const root = path.resolve(import.meta.dirname, "../../cloudflare");
execFileSync("bun", ["run", "build:development"], {
	cwd: root,
	stdio: "inherit",
});

const mf = new Miniflare({
	scriptPath: path.join(
		root,
		".cloudflare/output/v0/workers/default/bundle/index.js",
	),
	modules: true,
	modulesRoot: path.join(root, ".cloudflare/output/v0/workers/default/bundle"),
	compatibilityDate: "2026-03-01",
	compatibilityFlags: ["nodejs_compat"],
	port: 8788,
	d1Databases: { DB: "personal-website-e2e" },
	r2Buckets: { PHOTOS: "personal-website-e2e-private" },
	images: { binding: "IMAGES" },
	queueProducers: { PHOTO_QUEUE: "personal-website-e2e-photos" },
	queueConsumers: {
		"personal-website-e2e-photos": { maxBatchSize: 5, maxRetries: 5 },
	},
	bindings: { WORKER_API_SECRET: WORKER_SECRET, LOCAL_UPLOADS: "true" },
});

const db = await mf.getD1Database("DB");
const migrations = path.join(root, "migrations");
for (const file of (await readdir(migrations))
	.filter((f) => f.endsWith(".sql"))
	.sort()) {
	const statements = (await readFile(path.join(migrations, file), "utf8"))
		.split(";")
		.map((sql) => sql.trim())
		.filter(Boolean);
	await db.batch(statements.map((sql) => db.prepare(sql)));
}
console.log(`Worker ready at ${await mf.ready}`);
