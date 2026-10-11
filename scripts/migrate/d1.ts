// Runs SQL against the production D1 database through the cf CLI. D1_TARGET=local uses the local
// database that `bun run worker:migrate` set up instead (cf has no local query), for rehearsals.
import { Database } from "bun:sqlite";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const DATABASE = "6302f028-7188-46d5-8077-8a7fbfd0cc95";
const cloudflareDir = path.resolve(import.meta.dirname, "../../cloudflare");
const cf = path.join(cloudflareDir, "node_modules/.bin/cf");
type Param = string | number | null;

/** The local D1 file is named by a hash; it's the one with the most migrations applied. */
function localDatabase() {
	const dir = path.join(
		cloudflareDir,
		".wrangler/state/v3/d1/miniflare-D1DatabaseObject",
	);
	const candidates = readdirSync(dir)
		.filter((name) => name.endsWith(".sqlite") && name !== "metadata.sqlite")
		.map((name) => new Database(path.join(dir, name)))
		.map((db) => {
			try {
				const { n } = db
					.query("SELECT COUNT(*) AS n FROM d1_migrations")
					.get() as { n: number };
				return { db, n };
			} catch {
				return { db, n: -1 };
			}
		})
		.sort((a, b) => b.n - a.n);
	if (!candidates[0] || candidates[0].n < 0)
		throw new Error("No local D1 database; run bun run worker:migrate");
	return candidates[0].db;
}
const local = process.env.D1_TARGET === "local" ? localDatabase() : undefined;

function run(args: string[]) {
	const output = execFileSync(cf, ["d1", "query", DATABASE, ...args], {
		maxBuffer: 64 * 1024 * 1024,
	}).toString();
	return JSON.parse(output) as { results: unknown[]; success: boolean }[];
}
export async function d1<T>(sql: string, params: Param[] = []) {
	if (local) return local.query(sql).all(...params) as T[];
	const body = JSON.stringify({ sql, params });
	return run(["--body", body])[0]?.results as T[];
}
/** One request; D1 runs a batch as a single transaction. */
export async function d1Batch(statements: { sql: string; params: Param[] }[]) {
	if (!statements.length) return;
	if (local) {
		const db = local;
		db.transaction(() => {
			for (const { sql, params } of statements) db.query(sql).run(...params);
		})();
		return;
	}
	const dir = mkdtempSync(path.join(tmpdir(), "d1-batch-"));
	try {
		const file = path.join(dir, "batch.json");
		writeFileSync(file, JSON.stringify(statements));
		run(["--batch", `@${file}`]);
	} finally {
		rmSync(dir, { recursive: true });
	}
}
