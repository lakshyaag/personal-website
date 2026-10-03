import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { parseArgs } from "node:util";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import {
	type MigratedPhoto,
	type SourceEntry,
	deterministicPhotoId,
	migrationSql,
	sourceEntrySchema,
} from "../lib/migration/plan";
import { MAX_PHOTO_BYTES, timeZoneSchema } from "../shared/journal";

const { values } = parseArgs({
	options: {
		mode: { type: "string" },
		dir: { type: "string", default: "migration-artifacts/journal" },
		"time-zone": { type: "string" },
		target: { type: "string" },
		"persist-to": { type: "string" },
		"worker-config": { type: "string" },
		"confirm-staging": { type: "boolean", default: false },
	},
});
interface ExportedFile {
	ref: string;
	originalRef: string;
	file: string;
	sha256: string;
	byteSize: number;
}
interface Snapshot {
	exportedAt: string;
	entries: SourceEntry[];
	files: ExportedFile[];
	issues: string[];
}
const dir = path.resolve(values.dir ?? "migration-artifacts/journal");
const sha256 = (bytes: Uint8Array) =>
	createHash("sha256").update(bytes).digest("hex");
async function exportSnapshot() {
	const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
	const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
	if (!url || !key)
		throw new Error(
			"Set source Supabase URL and service-role key for the read-only export",
		);
	const supabase = createClient(url, key, {
		auth: { persistSession: false, autoRefreshToken: false },
	});
	async function table(name: string, columns: string) {
		const rows: Record<string, unknown>[] = [];
		for (let offset = 0; ; offset += 500) {
			const { data, error } = await supabase
				.from(name)
				.select(columns)
				.order("id")
				.range(offset, offset + 499);
			if (error) throw new Error(`Export failed for ${name}: ${error.message}`);
			rows.push(...(data as unknown as Record<string, unknown>[]));
			if (data.length < 500) return rows;
		}
	}
	const entries = (
		await table(
			"journal_entries",
			"id,entry_date,content,photos,created_at,updated_at",
		)
	).map((row) => sourceEntrySchema.parse(row));
	const assets = await table("photo_assets", "id,original_private_ref");
	// photo_derivatives has no standalone id. Fetch it by stable compound ordering.
	const derivatives: { photo_id: string; bucket: string; path: string }[] = [];
	for (let offset = 0; ; offset += 500) {
		const { data, error } = await supabase
			.from("photo_derivatives")
			.select("photo_id,bucket,path")
			.order("photo_id")
			.order("kind")
			.range(offset, offset + 499);
		if (error) throw new Error(`Derivative export failed: ${error.message}`);
		derivatives.push(...data);
		if (data.length < 500) break;
	}
	await mkdir(path.join(dir, "originals"), { recursive: true, mode: 0o700 });
	const snapshot: Snapshot = {
		exportedAt: new Date().toISOString(),
		entries,
		files: [],
		issues: [],
	};
	for (const ref of new Set(entries.flatMap((entry) => entry.photos ?? []))) {
		const derivative = derivatives.find(
			(row) =>
				`sb://${row.bucket}/${row.path}` === ref ||
				`${url}/storage/v1/object/public/${row.bucket}/${row.path}` === ref,
		);
		const asset = assets.find(
			(row) =>
				row.id === derivative?.photo_id || row.original_private_ref === ref,
		);
		const originalRef = asset?.original_private_ref;
		if (typeof originalRef !== "string" || !originalRef.startsWith("sb://")) {
			snapshot.issues.push(
				`Unresolved original for reference ${sha256(new TextEncoder().encode(ref)).slice(0, 12)}. No derivative was silently substituted.`,
			);
			continue;
		}
		const match = originalRef.match(/^sb:\/\/([^/]+)\/(.+)$/);
		if (!match) {
			snapshot.issues.push("Invalid original storage reference");
			continue;
		}
		const { data, error } = await supabase.storage
			.from(match[1])
			.download(match[2]);
		if (error || !data) {
			snapshot.issues.push(
				`Original download failed for ${derivative?.photo_id ?? "unmapped photo"}`,
			);
			continue;
		}
		const bytes = new Uint8Array(await data.arrayBuffer());
		const digest = sha256(bytes);
		const file = `originals/${digest}.bin`;
		await writeFile(path.join(dir, file), bytes, { mode: 0o600 });
		snapshot.files.push({
			ref,
			originalRef,
			file,
			sha256: digest,
			byteSize: bytes.length,
		});
	}
	await writeFile(
		path.join(dir, "snapshot.json"),
		JSON.stringify(snapshot, null, 2),
		{ mode: 0o600 },
	);
	console.log(
		JSON.stringify({
			mode: "export",
			entries: entries.length,
			originals: snapshot.files.length,
			issues: snapshot.issues.length,
			directory: dir,
		}),
	);
	if (snapshot.issues.length) process.exitCode = 1;
}
async function plan() {
	const timeZone = timeZoneSchema.parse(values["time-zone"]);
	const snapshot = JSON.parse(
		await readFile(path.join(dir, "snapshot.json"), "utf8"),
	) as Snapshot;
	if (snapshot.issues.length)
		throw new Error(
			"Resolve snapshot issues before planning. See snapshot.json.",
		);
	const photos: MigratedPhoto[] = [];
	await mkdir(path.join(dir, "display"), { recursive: true, mode: 0o700 });
	for (const raw of snapshot.entries) {
		const entry = sourceEntrySchema.parse(raw);
		for (const ref of entry.photos ?? []) {
			const source = snapshot.files.find((file) => file.ref === ref);
			if (!source)
				throw new Error(`Missing exported original for entry ${entry.id}`);
			const resolved = path.resolve(dir, source.file);
			if (!resolved.startsWith(`${dir}${path.sep}`))
				throw new Error("Unsafe snapshot file path");
			const original = await readFile(resolved);
			if (
				sha256(original) !== source.sha256 ||
				original.length !== source.byteSize
			)
				throw new Error("Export checksum mismatch");
			if (original.length > MAX_PHOTO_BYTES)
				throw new Error(
					`Original exceeds new 20 MB limit for ${entry.id}. Resolve explicitly; do not discard it.`,
				);
			const metadata = await sharp(original, {
				limitInputPixels: 40_000_000,
			}).metadata();
			const mimeTypes: Record<string, string> = {
				jpeg: "image/jpeg",
				png: "image/png",
				webp: "image/webp",
				avif: "image/avif",
			};
			const mimeType = mimeTypes[metadata.format ?? ""];
			if (!mimeType || !metadata.width || !metadata.height)
				throw new Error(
					`Unsupported original format for ${entry.id}. Resolve explicitly.`,
				);
			const id = deterministicPhotoId(entry.id, ref);
			const display = await sharp(original, { limitInputPixels: 40_000_000 })
				.rotate()
				.resize({
					width: 1600,
					height: 1600,
					fit: "inside",
					withoutEnlargement: true,
				})
				.webp({ quality: 85 })
				.toBuffer();
			const safe = await sharp(display).metadata();
			if (safe.exif || safe.xmp)
				throw new Error("Display metadata was not removed");
			const displayFile = `display/${id}.webp`;
			await writeFile(path.join(dir, displayFile), display, { mode: 0o600 });
			photos.push({
				id,
				entryId: entry.id,
				fileName: path.basename(source.originalRef),
				mimeType,
				byteSize: original.length,
				width: metadata.width,
				height: metadata.height,
				originalFile: source.file,
				displayFile,
				originalSha256: source.sha256,
				displaySha256: sha256(display),
				sourceRef: ref,
			});
		}
	}
	const sql = migrationSql(snapshot.entries, photos, timeZone);
	await writeFile(path.join(dir, "journal.sql"), sql, { mode: 0o600 });
	await writeFile(
		path.join(dir, "manifest.json"),
		JSON.stringify(
			{
				timeZone,
				exportedAt: snapshot.exportedAt,
				entries: snapshot.entries,
				photos,
			},
			null,
			2,
		),
		{ mode: 0o600 },
	);
	console.log(
		JSON.stringify({
			mode: "plan",
			entries: snapshot.entries.length,
			photos: photos.length,
			sql: path.join(dir, "journal.sql"),
			manifest: path.join(dir, "manifest.json"),
			note: "No target database or bucket was changed. Apply only to fresh staging resources.",
		}),
	);
}
async function apply() {
	const target = values.target;
	if (target !== "local" && target !== "staging")
		throw new Error(
			"Apply requires --target local or staging. Production imports are not enabled.",
		);
	if (target === "staging" && !values["confirm-staging"])
		throw new Error(
			"Add --confirm-staging to authorize changes to the staging resources only.",
		);
	const manifest = JSON.parse(
		await readFile(path.join(dir, "manifest.json"), "utf8"),
	) as { timeZone: string; entries: SourceEntry[]; photos: MigratedPhoto[] };
	const sql = migrationSql(
		manifest.entries,
		manifest.photos,
		manifest.timeZone,
	);
	if (sql !== (await readFile(path.join(dir, "journal.sql"), "utf8")))
		throw new Error("SQL plan does not match the manifest");
	const cli = promisify(execFile);
	if (target === "staging" && values["worker-config"])
		throw new Error(
			"Custom Worker configurations are allowed only for local rehearsals",
		);
	const config = path.resolve(
		values["worker-config"] ?? "cloudflare/wrangler.jsonc",
	);
	const common = [
		"--config",
		config,
		`--env=${target === "local" ? "" : "staging"}`,
	];
	if (target === "local" && values["persist-to"])
		common.push("--persist-to", path.resolve(values["persist-to"]));
	const location = target === "local" ? "--local" : "--remote";
	const database = `personal-journal-${target}`;
	async function wrangler(args: string[]) {
		try {
			return (
				await cli("bunx", ["wrangler", ...args, ...common], {
					maxBuffer: 4 * 1024 * 1024,
				})
			).stdout;
		} catch {
			throw new Error(
				"Cloudflare command failed. Check credentials, resource configuration, and whether the staging schema has been applied.",
			);
		}
	}
	const result = JSON.parse(
		await wrangler([
			"d1",
			"execute",
			database,
			location,
			"--command",
			"SELECT COUNT(*) AS count FROM journal_entries",
			"--json",
		]),
	) as { results: { count: number }[] }[];
	if (result[0]?.results[0]?.count !== 0)
		throw new Error(
			"Import requires an empty target journal. Existing entries will not be overwritten.",
		);
	let client: S3Client | undefined;
	if (target === "staging") {
		const {
			R2_ACCOUNT_ID: account,
			JOURNAL_R2_ACCESS_KEY_ID: accessKeyId,
			JOURNAL_R2_SECRET_ACCESS_KEY: secretAccessKey,
			JOURNAL_R2_BUCKET: bucket,
		} = process.env;
		if (
			!account ||
			!accessKeyId ||
			!secretAccessKey ||
			bucket !== "personal-journal-staging-private"
		)
			throw new Error(
				"Set staging-only R2 credentials and JOURNAL_R2_BUCKET=personal-journal-staging-private",
			);
		client = new S3Client({
			requestChecksumCalculation: "WHEN_REQUIRED",
			region: "auto",
			endpoint: `https://${account}.r2.cloudflarestorage.com`,
			credentials: { accessKeyId, secretAccessKey },
		});
	}
	for (const photo of manifest.photos) {
		for (const file of [
			{
				name: photo.originalFile,
				key: `originals/${photo.id}`,
				hash: photo.originalSha256,
				type: photo.mimeType,
			},
			{
				name: photo.displayFile,
				key: `display/${photo.id}/migration.webp`,
				hash: photo.displaySha256,
				type: "image/webp",
			},
		]) {
			const resolved = path.resolve(dir, file.name);
			if (!resolved.startsWith(`${dir}${path.sep}`))
				throw new Error("Unsafe manifest path");
			const bytes = await readFile(resolved);
			if (sha256(bytes) !== file.hash)
				throw new Error("Migration file checksum mismatch");
			if (target === "local")
				await wrangler([
					"r2",
					"object",
					"put",
					`personal-journal-local-private/${file.key}`,
					"--local",
					"--file",
					resolved,
					"--content-type",
					file.type,
				]);
			else
				await client?.send(
					new PutObjectCommand({
						Bucket: "personal-journal-staging-private",
						Key: file.key,
						Body: bytes,
						ContentType: file.type,
						Metadata: { sha256: file.hash },
					}),
				);
		}
	}
	await wrangler([
		"d1",
		"execute",
		database,
		location,
		"--file",
		path.join(dir, "journal.sql"),
	]);
	console.log(
		JSON.stringify({
			mode: "apply",
			target,
			entries: manifest.entries.length,
			photos: manifest.photos.length,
			note: "Run --mode verify against the same target Worker before acceptance.",
		}),
	);
}
async function verify() {
	const manifest = JSON.parse(
		await readFile(path.join(dir, "manifest.json"), "utf8"),
	) as { timeZone: string; entries: SourceEntry[]; photos: MigratedPhoto[] };
	const url = new URL(process.env.CLOUDFLARE_WORKER_URL ?? "");
	const secret = process.env.CLOUDFLARE_WORKER_SECRET;
	if (!secret || secret.length < 32 || /REPLACE|placeholder/i.test(secret))
		throw new Error("Set the target Worker URL and secret");
	if (
		url.protocol !== "https:" &&
		!(
			url.protocol === "http:" &&
			["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
		)
	)
		throw new Error("Use HTTPS or a local Worker");
	async function get(endpoint: string) {
		const response = await fetch(new URL(endpoint, url), {
			headers: { Authorization: `Bearer ${secret}` },
			redirect: "error",
			signal: AbortSignal.timeout(30000),
		});
		if (!response.ok)
			throw new Error(`Verification request failed (${response.status})`);
		return response;
	}
	const expectedIds = new Set(manifest.entries.map((entry) => entry.id));
	const foundIds = new Set<string>();
	let cursor: string | null = null;
	do {
		const result: { entries: { id: string }[]; nextCursor: string | null } =
			await (
				await get(
					`/v1/journal?limit=50${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
				)
			).json();
		for (const entry of result.entries) {
			if (!expectedIds.has(entry.id) || foundIds.has(entry.id))
				throw new Error("Target entry count or pagination mismatch");
			foundIds.add(entry.id);
		}
		cursor = result.nextCursor;
	} while (cursor);
	if (foundIds.size !== expectedIds.size)
		throw new Error("Target entry count mismatch");
	for (const source of manifest.entries) {
		const entry = (await (await get(`/v1/journal/${source.id}`)).json()) as {
			date: string;
			timeZone: string;
			content: string;
			createdAt: string;
			updatedAt: string;
			photos: { id: string; state: string }[];
		};
		if (
			entry.date !== source.entry_date ||
			entry.content !== (source.content ?? "") ||
			entry.createdAt !== source.created_at ||
			entry.updatedAt !== source.updated_at ||
			entry.timeZone !== manifest.timeZone
		)
			throw new Error(`Entry mismatch: ${source.id}`);
		const expected = manifest.photos.filter(
			(photo) => photo.entryId === source.id,
		);
		if (
			entry.photos.length !== expected.length ||
			entry.photos.some(
				(photo, position) =>
					photo.id !== expected[position]?.id || photo.state !== "ready",
			)
		)
			throw new Error(`Photo relationship mismatch: ${source.id}`);
	}
	for (const photo of manifest.photos) {
		const original = new Uint8Array(
			await (await get(`/v1/photos/${photo.id}/original`)).arrayBuffer(),
		);
		const display = new Uint8Array(
			await (await get(`/v1/photos/${photo.id}/display`)).arrayBuffer(),
		);
		if (
			original.length !== photo.byteSize ||
			sha256(original) !== photo.originalSha256 ||
			sha256(display) !== photo.displaySha256
		)
			throw new Error(`File checksum mismatch: ${photo.id}`);
		const metadata = await sharp(display).metadata();
		if (metadata.exif || metadata.xmp)
			throw new Error(`Unexpected display metadata: ${photo.id}`);
	}
	console.log(
		JSON.stringify({
			mode: "verify",
			entries: foundIds.size,
			photos: manifest.photos.length,
			result: "All counts, fields, relationships, sizes, and checksums match",
		}),
	);
}
try {
	if (values.mode === "export") await exportSnapshot();
	else if (values.mode === "plan") await plan();
	else if (values.mode === "apply") await apply();
	else if (values.mode === "verify") await verify();
	else
		throw new Error(
			"Use --mode export, --mode plan --time-zone <historical IANA zone>, or --mode verify. See docs/cloudflare-migration.md.",
		);
} catch (error) {
	console.error(error instanceof Error ? error.message : "Migration failed");
	process.exitCode = 1;
}
