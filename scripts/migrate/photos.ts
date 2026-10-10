// One-off: copy Supabase photo_assets (except journal photos, already migrated) into the
// shared Cloudflare photo library. Read-only against Supabase. Idempotent.
//   bun --env-file=.env.local scripts/migrate/photos.ts plan|apply|variants|verify
// "variants" (re)generates display/thumb for every photo locally, as the browser does on upload.
import { createHash } from "node:crypto";
import {
	DeleteObjectsCommand,
	GetObjectCommand,
	HeadObjectCommand,
	ListObjectsV2Command,
	PutObjectCommand,
	S3Client,
} from "@aws-sdk/client-s3";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { extractMetadata } from "../../shared/exif";
import { originalKey, variantKey, variantSizes } from "../../shared/photos";
import { d1, d1Batch } from "./d1";

const mode = process.argv[2];
if (!["plan", "apply", "variants", "verify"].includes(mode ?? ""))
	throw new Error("Usage: photos.ts plan|apply|variants|verify");

const env = process.env;
const supabase = createClient(
	env.NEXT_PUBLIC_SUPABASE_URL ?? "",
	env.SUPABASE_SERVICE_ROLE_KEY ?? "",
	{ auth: { persistSession: false } },
);
const bucket = env.PRIVATE_R2_BUCKET ?? "";
const r2 = new S3Client({
	region: "auto",
	endpoint: `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
	credentials: {
		accessKeyId: env.PRIVATE_R2_ACCESS_KEY_ID ?? "",
		secretAccessKey: env.PRIVATE_R2_SECRET_ACCESS_KEY ?? "",
	},
});

interface Asset {
	id: string;
	original_private_ref: string;
	visibility: "private" | "unlisted" | "public";
	gallery_featured: boolean;
	title: string | null;
	caption: string | null;
	location_label: string | null;
	taken_at: string | null;
	gps_latitude: number | null;
	gps_longitude: number | null;
	gps_public: boolean;
	safe_exif: Record<string, unknown> | null;
	created_at: string;
}
interface Attachment {
	photo_id: string;
	context_type: string;
	context_id: string;
	sort_order: number;
	created_at: string;
}
async function all<T>(table: string) {
	const { data, error } = await supabase.from(table).select("*");
	if (error) throw new Error(`${table}: ${error.message}`);
	return data as T[];
}
const iso = (value: string | null) =>
	value ? new Date(value).toISOString() : null;
const sha256 = (bytes: Uint8Array) =>
	createHash("sha256").update(bytes).digest("hex");
const contexts: Record<string, string | null> = {
	airport_visit: "visit",
	food: "food",
	workout: "workout",
	gallery: null, // becomes featured
	fit: null, // feature dropped; photo stays in the library
};

const assets = await all<Asset>("photo_assets");
const attachments = await all<Attachment>("photo_attachments");
const journalIds = new Set(
	attachments
		.filter((a) => a.context_type === "journal")
		.map((a) => a.photo_id),
);
const photos = assets.filter((asset) => !journalIds.has(asset.id));
const unknown = attachments.filter(
	(a) => !(a.context_type in contexts) && a.context_type !== "journal",
);
if (unknown.length)
	throw new Error(`Unmapped contexts: ${unknown.map((a) => a.context_type)}`);

// Positions are renumbered per context in Supabase sort order.
const grouped = new Map<string, Attachment[]>();
for (const a of attachments) {
	const context = contexts[a.context_type];
	if (!context) continue;
	const key = `${context}:${a.context_id}`;
	grouped.set(key, [...(grouped.get(key) ?? []), a]);
}
const links = [...grouped.entries()].flatMap(([key, items]) => {
	const separator = key.indexOf(":");
	const [context, contextId] = [
		key.slice(0, separator),
		key.slice(separator + 1),
	];
	return items
		.sort(
			(a, b) =>
				a.sort_order - b.sort_order || a.created_at.localeCompare(b.created_at),
		)
		.map((a, position) => ({
			photoId: a.photo_id,
			context,
			contextId,
			position,
		}));
});
const featured = new Set(
	attachments
		.filter((a) => a.context_type === "gallery")
		.map((a) => a.photo_id),
);
function row(asset: Asset) {
	const exif = asset.safe_exif ?? {};
	const camera = {
		make: exif.make ?? null,
		model: exif.model ?? null,
		lens: exif.lensModel ?? null,
		fNumber: exif.fNumber ?? null,
		exposureTime: exif.exposureTime ?? null,
		iso: exif.iso ?? null,
	};
	return {
		id: asset.id,
		fileName: asset.original_private_ref.split("/").pop() ?? "original.jpeg",
		visibility: asset.visibility === "public" ? "public" : "private",
		featured: asset.gallery_featured || featured.has(asset.id) ? 1 : 0,
		title: asset.title,
		caption: asset.caption,
		location: asset.location_label,
		takenAt: iso(asset.taken_at),
		latitude: asset.gps_latitude,
		longitude: asset.gps_longitude,
		showLocation: asset.gps_public ? 1 : 0,
		camera: Object.values(camera).some((v) => v !== null)
			? JSON.stringify(camera)
			: null,
		createdAt: iso(asset.created_at) ?? new Date().toISOString(),
	};
}
async function original(asset: Asset) {
	const path = asset.original_private_ref.replace("sb://photo-originals/", "");
	const { data, error } = await supabase.storage
		.from("photo-originals")
		.download(path);
	if (error || !data) throw new Error(`Download failed: ${asset.id}`);
	return new Uint8Array(await data.arrayBuffer());
}

if (mode === "plan") {
	console.log({
		supabaseAssets: assets.length,
		skippedJournal: journalIds.size,
		toImport: photos.length,
		links: links.length,
		linksByContext: Object.fromEntries(
			[...new Set(links.map((l) => l.context))].map((c) => [
				c,
				links.filter((l) => l.context === c).length,
			]),
		),
		featured: photos.filter((p) => row(p).featured).length,
		public: photos.filter((p) => row(p).visibility === "public").length,
	});
}

if (mode === "apply") {
	let uploaded = 0;
	for (const asset of photos) {
		const bytes = await original(asset);
		const key = `originals/${asset.id}`;
		const existing = await r2
			.send(new HeadObjectCommand({ Bucket: bucket, Key: key }))
			.catch(() => null);
		if (existing && existing.ContentLength !== bytes.length)
			throw new Error(`Different object already at ${key}`);
		if (!existing) {
			await r2.send(
				new PutObjectCommand({
					Bucket: bucket,
					Key: key,
					Body: bytes,
					ContentType: "image/jpeg",
					IfNoneMatch: "*",
				}),
			);
			uploaded++;
		}
		const r = row(asset);
		// Queued rows are picked up by the Worker's scheduled recovery and processed normally.
		await d1(
			`INSERT INTO photos(id,file_name,mime_type,byte_size,state,visibility,featured,title,caption,location,taken_at,latitude,longitude,show_location,camera,created_at,updated_at)
			VALUES (?,?,'image/jpeg',?,'queued',?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING`,
			[
				r.id,
				r.fileName,
				bytes.length,
				r.visibility,
				r.featured,
				r.title,
				r.caption,
				r.location,
				r.takenAt,
				r.latitude,
				r.longitude,
				r.showLocation,
				r.camera,
				r.createdAt,
				new Date().toISOString(),
			],
		);
	}
	await d1Batch(
		links.map((l) => ({
			sql: "INSERT INTO photo_links(photo_id,context,context_id,position) VALUES (?,?,?,?) ON CONFLICT DO NOTHING",
			params: [l.photoId, l.context, l.contextId, l.position],
		})),
	);
	console.log({ imported: photos.length, uploaded, links: links.length });
}

async function r2Bytes(key: string) {
	const object = await r2.send(
		new GetObjectCommand({ Bucket: bucket, Key: key }),
	);
	return new Uint8Array((await object.Body?.transformToByteArray()) ?? []);
}

if (mode === "variants") {
	const rows = await d1<{ id: string; state: string }>(
		"SELECT id, state FROM photos WHERE state != 'deleting'",
	);
	const updates: { sql: string; params: (string | number | null)[] }[] = [];
	for (const row of rows) {
		const original = await r2Bytes(originalKey(row.id));
		const generation = crypto.randomUUID();
		// rotate() applies EXIF orientation; sharp drops all metadata from output by default.
		const variant = (size: number, quality: number) =>
			sharp(original)
				.rotate()
				.resize({
					width: size,
					height: size,
					fit: "inside",
					withoutEnlargement: true,
				})
				.webp({ quality })
				.toBuffer();
		const [display, thumb, info, metadata] = await Promise.all([
			variant(variantSizes.display, 85),
			variant(variantSizes.thumb, 78),
			sharp(original).metadata(),
			extractMetadata(original.slice(0, 512 * 1024).buffer),
		]);
		for (const [name, body] of [
			["display", display],
			["thumb", thumb],
		] as const)
			await r2.send(
				new PutObjectCommand({
					Bucket: bucket,
					Key: variantKey(row.id, generation, name),
					Body: body,
					ContentType: "image/webp",
				}),
			);
		const rotated = (info.orientation ?? 1) >= 5;
		updates.push({
			sql: `UPDATE photos SET state='ready',generation=?,width=?,height=?,
				taken_at=COALESCE(taken_at,?),latitude=COALESCE(latitude,?),longitude=COALESCE(longitude,?),camera=COALESCE(camera,?),updated_at=?
				WHERE id=? AND state != 'deleting'`,
			params: [
				generation,
				(rotated ? info.height : info.width) ?? null,
				(rotated ? info.width : info.height) ?? null,
				metadata.takenAt,
				metadata.latitude,
				metadata.longitude,
				metadata.camera ? JSON.stringify(metadata.camera) : null,
				new Date().toISOString(),
				row.id,
			],
		});
	}
	await d1Batch(updates);
	// Old Worker-made variants lived under display/; nothing references them now.
	let removed = 0;
	let token: string | undefined;
	do {
		const page = await r2.send(
			new ListObjectsV2Command({
				Bucket: bucket,
				Prefix: "display/",
				ContinuationToken: token,
			}),
		);
		const keys = (page.Contents ?? []).map((object) => ({ Key: object.Key }));
		if (keys.length) {
			await r2.send(
				new DeleteObjectsCommand({ Bucket: bucket, Delete: { Objects: keys } }),
			);
			removed += keys.length;
		}
		token = page.NextContinuationToken;
	} while (token);
	console.log({ regenerated: rows.length, oldVariantsRemoved: removed });
}

if (mode === "verify") {
	const problems: string[] = [];
	const rows = new Map(
		(await d1<Record<string, unknown>>("SELECT * FROM photos")).map((r) => [
			r.id,
			r,
		]),
	);
	for (const asset of photos) {
		const stored = rows.get(asset.id);
		if (!stored) {
			problems.push(`missing ${asset.id}`);
			continue;
		}
		const expected = row(asset);
		if (stored.state !== "ready")
			problems.push(`${asset.id} is ${stored.state}`);
		for (const [column, value] of [
			["visibility", expected.visibility],
			["featured", expected.featured],
			["title", expected.title],
			["caption", expected.caption],
			["location", expected.location],
			["show_location", expected.showLocation],
			["created_at", expected.createdAt],
			// Supabase values win over EXIF; processing only fills empty fields.
			["taken_at", expected.takenAt ?? stored.taken_at],
			["latitude", expected.latitude ?? stored.latitude],
		] as const)
			if (stored[column] !== value)
				problems.push(`${asset.id} ${column}: ${stored[column]} != ${value}`);
		const source = sha256(await original(asset));
		const copy = await r2.send(
			new GetObjectCommand({ Bucket: bucket, Key: `originals/${asset.id}` }),
		);
		const target = sha256(
			new Uint8Array(await (copy.Body?.transformToByteArray() ?? [])),
		);
		if (source !== target)
			problems.push(`${asset.id} original checksum differs`);
	}
	const storedLinks = await d1<Record<string, unknown>>(
		"SELECT photo_id,context,context_id,position FROM photo_links WHERE context != 'journal'",
	);
	const key = (l: {
		photoId?: unknown;
		photo_id?: unknown;
		context: unknown;
		contextId?: unknown;
		context_id?: unknown;
		position: unknown;
	}) =>
		`${l.photoId ?? l.photo_id}|${l.context}|${l.contextId ?? l.context_id}|${l.position}`;
	const expectedLinks = new Set(links.map(key));
	const actualLinks = new Set(storedLinks.map((l) => key(l as never)));
	for (const k of expectedLinks)
		if (!actualLinks.has(k)) problems.push(`missing link ${k}`);
	for (const k of actualLinks)
		if (!expectedLinks.has(k)) problems.push(`extra link ${k}`);
	console.log({ checked: photos.length, links: actualLinks.size, problems });
	if (problems.length) process.exitCode = 1;
}
