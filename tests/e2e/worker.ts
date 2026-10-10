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

const bundle = path.join(root, ".cloudflare/output/v0/workers/default/bundle");
const mf = new Miniflare({
	// Explicit modules: the bundle has a dynamic import (exifr) that auto-discovery rejects.
	modules: await Promise.all(
		(await readdir(bundle))
			.filter((file) => file.endsWith(".js"))
			.map(async (file) => ({
				type: "ESModule" as const,
				path: path.join(bundle, file),
				contents: await readFile(path.join(bundle, file), "utf8"),
			})),
	),
	compatibilityDate: "2026-03-01",
	compatibilityFlags: ["nodejs_compat"],
	port: 8788,
	d1Databases: { DB: "personal-website-e2e" },
	r2Buckets: { PHOTOS: "personal-website-e2e-private" },
	bindings: { WORKER_API_SECRET: WORKER_SECRET, LOCAL_UPLOADS: "true" },
});

const db = await mf.getD1Database("DB");
const migrations = path.join(root, "migrations");
for (const file of (await readdir(migrations))
	.filter((f) => f.endsWith(".sql"))
	.sort()) {
	const statements = (await readFile(path.join(migrations, file), "utf8"))
		.replace(/^--.*$/gm, "")
		.split(";")
		.map((sql) => sql.trim())
		.filter(Boolean);
	await db.batch(statements.map((sql) => db.prepare(sql)));
}
console.log(`Worker ready at ${await mf.ready}`);
