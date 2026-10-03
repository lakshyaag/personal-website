import { execFile, spawn } from "node:child_process";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import sharp from "sharp";

const run = promisify(execFile);
const temporary = await mkdtemp(path.join(tmpdir(), "journal-rehearsal-"));
const directory = path.join(temporary, "export");
const persistence = path.join(temporary, "state");
const config = path.resolve("cloudflare/test/wrangler.jsonc");
const environment = {
	...process.env,
	CLOUDFLARE_SEND_METRICS: "false",
	CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false",
};
let worker: ReturnType<typeof spawn> | undefined;
async function freePort() {
	const server = createServer();
	await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
	const address = server.address();
	if (!address || typeof address === "string")
		throw new Error("Cannot allocate a test port");
	await new Promise<void>((resolve, reject) =>
		server.close((error) => (error ? reject(error) : resolve())),
	);
	return address.port;
}
try {
	await mkdir(path.join(directory, "originals"), { recursive: true });
	const original = await sharp({
		create: { width: 48, height: 32, channels: 3, background: "#819f86" },
	})
		.jpeg()
		.withExif({ IFD0: { Artist: "Synthetic private metadata" } })
		.toBuffer();
	const hash = createHash("sha256").update(original).digest("hex");
	const ref = "sb://old-private/synthetic.jpg";
	await writeFile(path.join(directory, `originals/${hash}.bin`), original);
	await writeFile(
		path.join(directory, "snapshot.json"),
		JSON.stringify({
			exportedAt: new Date().toISOString(),
			issues: [],
			entries: [
				{
					id: randomUUID(),
					entry_date: "2026-04-16",
					content:
						"Migration rehearsal: Don't lose dates.\nUnicode survives: 📝",
					photos: [ref],
					created_at: "2026-04-15T20:30:00.000Z",
					updated_at: "2026-04-16T04:00:00.000Z",
				},
				{
					id: randomUUID(),
					entry_date: "2026-04-17",
					content: "Migration rehearsal: Text only",
					photos: [],
					created_at: "2026-04-17T02:00:00.000Z",
					updated_at: "2026-04-17T02:00:00.000Z",
				},
			],
			files: [
				{
					ref,
					originalRef: ref,
					file: `originals/${hash}.bin`,
					sha256: hash,
					byteSize: original.length,
				},
			],
		}),
	);
	await run(
		"bun",
		[
			"scripts/migrate-journal.ts",
			"--mode",
			"plan",
			"--dir",
			directory,
			"--time-zone",
			"Asia/Kolkata",
		],
		{ env: environment },
	);
	await run(
		"bunx",
		[
			"wrangler",
			"d1",
			"migrations",
			"apply",
			"personal-journal-local",
			"--local",
			"--config",
			config,
			"--persist-to",
			persistence,
		],
		{ env: environment },
	);
	await run(
		"bun",
		[
			"scripts/migrate-journal.ts",
			"--mode",
			"apply",
			"--target",
			"local",
			"--dir",
			directory,
			"--persist-to",
			persistence,
			"--worker-config",
			config,
		],
		{ env: environment },
	);
	const secret = randomBytes(32).toString("hex");
	const port = await freePort();
	const inspector = await freePort();
	worker = spawn(
		"bunx",
		[
			"wrangler",
			"dev",
			"--config",
			config,
			"--persist-to",
			persistence,
			"--port",
			String(port),
			"--inspector-port",
			String(inspector),
			"--var",
			`WORKER_API_SECRET:${secret}`,
		],
		{ env: environment, detached: true, stdio: ["ignore", "pipe", "pipe"] },
	);
	worker.stdout?.resume();
	worker.stderr?.resume();
	const workerUrl = `http://127.0.0.1:${port}`;
	let healthy = false;
	for (let attempt = 0; attempt < 60; attempt++) {
		try {
			healthy = (
				await fetch(`${workerUrl}/v1/health`, {
					headers: { Authorization: `Bearer ${secret}` },
					signal: AbortSignal.timeout(1000),
				})
			).ok;
		} catch {
			/* Wait for the local runtime. */
		}
		if (healthy) break;
		await new Promise((resolve) => setTimeout(resolve, 500));
	}
	if (!healthy) throw new Error("Local rehearsal Worker did not start");
	const verified = await run(
		"bun",
		["scripts/migrate-journal.ts", "--mode", "verify", "--dir", directory],
		{
			env: {
				...environment,
				CLOUDFLARE_WORKER_URL: workerUrl,
				CLOUDFLARE_WORKER_SECRET: secret,
			},
		},
	);
	console.log(verified.stdout.trim());
	console.log(
		"Synthetic migration rehearsal passed. No Supabase or remote Cloudflare resources were accessed.",
	);
} catch (error) {
	console.error(
		error instanceof Error ? error.message : "Migration rehearsal failed",
	);
	process.exitCode = 1;
} finally {
	if (worker?.pid && worker.exitCode === null) {
		const exited = new Promise<void>((resolve) =>
			worker?.once("exit", () => resolve()),
		);
		try {
			process.kill(-worker.pid, "SIGTERM");
		} catch {
			/* Already exited. */
		}
		await Promise.race([
			exited,
			new Promise((resolve) => setTimeout(resolve, 2000)),
		]);
		if (worker.exitCode === null) {
			try {
				process.kill(-worker.pid, "SIGKILL");
			} catch {
				/* Already exited. */
			}
		}
	}
	await rm(temporary, { recursive: true, force: true });
}
