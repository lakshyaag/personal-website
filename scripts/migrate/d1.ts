// Runs SQL against the production D1 database through the cf CLI.
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const DATABASE = "6302f028-7188-46d5-8077-8a7fbfd0cc95";
const cf = path.resolve(
	import.meta.dirname,
	"../../cloudflare/node_modules/.bin/cf",
);
type Param = string | number | null;

function run(args: string[]) {
	const output = execFileSync(cf, ["d1", "query", DATABASE, ...args], {
		maxBuffer: 64 * 1024 * 1024,
	}).toString();
	return JSON.parse(output) as { results: unknown[]; success: boolean }[];
}
export async function d1<T>(sql: string, params: Param[] = []) {
	const body = JSON.stringify({ sql, params });
	return run(["--body", body])[0]?.results as T[];
}
/** One request; D1 runs a batch as a single transaction. */
export async function d1Batch(statements: { sql: string; params: Param[] }[]) {
	if (!statements.length) return;
	const dir = mkdtempSync(path.join(tmpdir(), "d1-batch-"));
	try {
		const file = path.join(dir, "batch.json");
		writeFileSync(file, JSON.stringify(statements));
		run(["--batch", `@${file}`]);
	} finally {
		rmSync(dir, { recursive: true });
	}
}
