import exifr from "exifr";
import { z } from "zod";
import { idSchema } from "../../shared/common";
import {
	type Camera,
	type LibraryPhoto,
	type Photo,
	type PhotoContext,
	type PhotoVariant,
	type UpdatePhotoInput,
	cameraSchema,
	type createPhotoSchema,
	originalKey,
	photoContexts,
	variantKey,
} from "../../shared/photos";
import {
	ApiError,
	type Env,
	type SqlValue,
	decodeCursor,
	encodeCursor,
	now,
	statement,
} from "./http";

export interface PhotoRow {
	id: string;
	file_name: string;
	mime_type: string;
	byte_size: number;
	state: Photo["state"];
	width: number | null;
	height: number | null;
	error: string | null;
	generation: string | null;
	attempts: number;
	lease_until: string | null;
	visibility: Photo["visibility"];
	featured: number;
	title: string | null;
	caption: string | null;
	location: string | null;
	taken_at: string | null;
	latitude: number | null;
	longitude: number | null;
	show_location: number;
	camera: string | null;
	created_at: string;
	updated_at: string;
}
interface LinkRow {
	photo_id: string;
	context: PhotoContext;
	context_id: string;
	position: number;
}

function parseCamera(value: string | null): Camera | null {
	if (!value) return null;
	try {
		return cameraSchema.parse(JSON.parse(value));
	} catch {
		return null;
	}
}
export const photoDto = (row: PhotoRow): Photo => ({
	id: row.id,
	state: row.state,
	fileName: row.file_name,
	mimeType: row.mime_type,
	byteSize: row.byte_size,
	width: row.width,
	height: row.height,
	error: row.error,
	generation: row.state === "ready" ? row.generation : null,
	visibility: row.visibility,
	featured: row.featured === 1,
	title: row.title,
	caption: row.caption,
	location: row.location,
	takenAt: row.taken_at,
	latitude: row.latitude,
	longitude: row.longitude,
	showLocation: row.show_location === 1,
	camera: parseCamera(row.camera),
	createdAt: row.created_at,
});
export async function photoRow(env: Env, id: string) {
	const photo = await statement(
		env,
		"SELECT * FROM photos WHERE id = ?",
		id,
	).first<PhotoRow>();
	if (!photo) throw new ApiError(404, "NOT_FOUND", "Photo not found");
	return photo;
}
const placeholders = (count: number) => Array(count).fill("?").join(",");

/** Photos linked to each context id, in link order. One query for any number of ids. */
export async function linkedPhotos(
	env: Env,
	context: PhotoContext,
	contextIds: string[],
) {
	const byContext = new Map<string, Photo[]>(contextIds.map((id) => [id, []]));
	if (!contextIds.length) return byContext;
	const { results } = await statement(
		env,
		`SELECT p.*, l.context_id AS link_context_id FROM photo_links l JOIN photos p ON p.id = l.photo_id
		WHERE l.context = ? AND l.context_id IN (${placeholders(contextIds.length)}) ORDER BY l.position`,
		context,
		...contextIds,
	).all<PhotoRow & { link_context_id: string }>();
	for (const row of results)
		byContext.get(row.link_context_id)?.push(photoDto(row));
	return byContext;
}

/**
 * Statements that replace a context's photo links inside the caller's batch. The batch fails
 * unless every photo is ready. Private, unfeatured photos dropped from the context and used
 * nowhere else are deleted: they belonged to that entry. Library (public or featured) photos stay.
 */
export async function replaceLinks(
	env: Env,
	context: PhotoContext,
	contextId: string,
	photoIds: string[],
) {
	const previous = (
		await statement(
			env,
			"SELECT photo_id FROM photo_links WHERE context = ? AND context_id = ?",
			context,
			contextId,
		).all<{ photo_id: string }>()
	).results
		.map((row) => row.photo_id)
		.filter((id) => !photoIds.includes(id));
	const statements: D1PreparedStatement[] = [];
	if (photoIds.length) {
		const assertionId = crypto.randomUUID();
		statements.push(
			statement(
				env,
				`INSERT INTO write_assertions(id,ok) SELECT ?, CASE WHEN COUNT(*) = ? THEN 1 ELSE 0 END FROM photos WHERE id IN (${placeholders(photoIds.length)}) AND state = 'ready'`,
				assertionId,
				photoIds.length,
				...photoIds,
			),
			statement(env, "DELETE FROM write_assertions WHERE id = ?", assertionId),
		);
	}
	statements.push(
		statement(
			env,
			"DELETE FROM photo_links WHERE context = ? AND context_id = ?",
			context,
			contextId,
		),
		...photoIds.map((id, index) =>
			statement(
				env,
				"INSERT INTO photo_links(photo_id,context,context_id,position) VALUES (?,?,?,?)",
				id,
				context,
				contextId,
				index,
			),
		),
	);
	if (previous.length)
		statements.push(
			statement(
				env,
				`UPDATE photos SET state='deleting',updated_at=? WHERE id IN (${placeholders(previous.length)})
				AND visibility='private' AND featured=0 AND NOT EXISTS(SELECT 1 FROM photo_links WHERE photo_id=photos.id)`,
				now(),
				...previous,
			),
		);
	return statements;
}

export async function createPhoto(
	env: Env,
	data: z.infer<typeof createPhotoSchema>,
) {
	const timestamp = now();
	await statement(
		env,
		"INSERT INTO photos(id,file_name,mime_type,byte_size,state,created_at,updated_at) VALUES (?,?,?,?,'pending',?,?) ON CONFLICT(id) DO NOTHING",
		data.id,
		data.fileName,
		data.mimeType,
		data.byteSize,
		timestamp,
		timestamp,
	).run();
	const row = await photoRow(env, data.id);
	if (
		row.byte_size !== data.byteSize ||
		row.mime_type !== data.mimeType ||
		row.file_name !== data.fileName ||
		row.state === "deleting"
	)
		throw new ApiError(409, "CONFLICT", "Photo ID already in use");
	return photoDto(row);
}

const listFilterSchema = z.object({
	limit: z.coerce.number().int().min(1).max(200).default(60),
	visibility: z.enum(["private", "public"]).optional(),
	featured: z.enum(["true"]).optional(),
	context: z.enum(photoContexts).optional(),
	unused: z.enum(["true"]).optional(),
});
export async function listPhotos(env: Env, url: URL) {
	const filter = listFilterSchema.parse(
		Object.fromEntries(
			[...url.searchParams].filter(([key]) => key !== "cursor"),
		),
	);
	const cursor = decodeCursor(url.searchParams.get("cursor"), 2);
	const where = ["state = 'ready'"];
	const params: SqlValue[] = [];
	if (filter.visibility) {
		where.push("visibility = ?");
		params.push(filter.visibility);
	}
	if (filter.featured) where.push("featured = 1");
	if (filter.context) {
		where.push(
			"EXISTS(SELECT 1 FROM photo_links WHERE photo_id = photos.id AND context = ?)",
		);
		params.push(filter.context);
	}
	if (filter.unused)
		where.push(
			"NOT EXISTS(SELECT 1 FROM photo_links WHERE photo_id = photos.id)",
		);
	if (cursor) {
		where.push("(created_at, id) < (?, ?)");
		params.push(...cursor);
	}
	const { results } = await statement(
		env,
		`SELECT * FROM photos WHERE ${where.join(" AND ")} ORDER BY created_at DESC, id DESC LIMIT ?`,
		...params,
		filter.limit + 1,
	).all<PhotoRow>();
	const page = results.slice(0, filter.limit);
	const links = new Map<string, LibraryPhoto["links"]>();
	if (page.length) {
		const { results: rows } = await statement(
			env,
			`SELECT * FROM photo_links WHERE photo_id IN (${placeholders(page.length)}) ORDER BY context, context_id`,
			...page.map((row) => row.id),
		).all<LinkRow>();
		for (const row of rows) {
			const list = links.get(row.photo_id) ?? [];
			list.push({ context: row.context, contextId: row.context_id });
			links.set(row.photo_id, list);
		}
	}
	const last = page.at(-1);
	return {
		photos: page.map((row) => ({
			...photoDto(row),
			links: links.get(row.id) ?? [],
		})),
		nextCursor:
			results.length > filter.limit && last
				? encodeCursor([last.created_at, last.id])
				: null,
	};
}

export async function updatePhoto(
	env: Env,
	id: string,
	input: UpdatePhotoInput,
) {
	const columns: Record<keyof UpdatePhotoInput, string> = {
		visibility: "visibility",
		featured: "featured",
		title: "title",
		caption: "caption",
		location: "location",
		showLocation: "show_location",
	};
	const sets: string[] = [];
	const values: SqlValue[] = [];
	for (const [key, value] of Object.entries(input) as [
		keyof UpdatePhotoInput,
		UpdatePhotoInput[keyof UpdatePhotoInput],
	][]) {
		if (value === undefined) continue;
		sets.push(`${columns[key]} = ?`);
		values.push(typeof value === "boolean" ? Number(value) : value);
	}
	const row = await photoRow(env, id);
	if (row.state === "deleting")
		throw new ApiError(404, "NOT_FOUND", "Photo not found");
	if (sets.length)
		await statement(
			env,
			`UPDATE photos SET ${sets.join(", ")}, updated_at = ? WHERE id = ? AND state != 'deleting'`,
			...values,
			now(),
			id,
		).run();
	return photoDto(await photoRow(env, id));
}

export async function deletePhoto(env: Env, id: string) {
	await photoRow(env, id);
	const removed = await statement(
		env,
		"UPDATE photos SET state='deleting',updated_at=? WHERE id=? AND NOT EXISTS(SELECT 1 FROM photo_links WHERE photo_id=?)",
		now(),
		id,
		id,
	).run();
	if (!removed.meta.changes)
		throw new ApiError(
			409,
			"ATTACHED",
			"This photo is attached to an entry. Remove it there and save first.",
		);
}

async function dispatchPhoto(env: Env, id: string) {
	// D1 state is the durable outbox. Scheduled recovery retries failed sends.
	try {
		await env.PHOTO_QUEUE.send({ id });
	} catch {
		console.error(
			JSON.stringify({ code: "PHOTO_DISPATCH_FAILED", photoId: id }),
		);
	}
}
export async function completePhoto(env: Env, id: string, retry = false) {
	const row = await photoRow(env, id);
	if (["ready", "processing", "queued"].includes(row.state))
		return photoDto(row);
	if (row.state === "deleting")
		throw new ApiError(409, "CONFLICT", "Photo is being removed");
	if (row.state === "failed" && !retry) return photoDto(row);
	const object = await env.PHOTOS.head(originalKey(id));
	if (!object)
		throw new ApiError(
			409,
			"UPLOAD_MISSING",
			"Upload is not complete. Retry the file upload.",
		);
	if (
		object.size !== row.byte_size ||
		object.httpMetadata?.contentType !== row.mime_type
	)
		throw new ApiError(
			400,
			"INVALID_UPLOAD",
			"Stored file does not match the declared file",
		);
	await statement(
		env,
		"UPDATE photos SET state='queued',error=NULL,attempts=0,updated_at=? WHERE id=? AND state IN ('pending','failed')",
		now(),
		id,
	).run();
	await dispatchPhoto(env, id);
	return photoDto(await photoRow(env, id));
}

export function assertSafeWebp(bytes: Uint8Array) {
	const text = (start: number, end: number) =>
		new TextDecoder().decode(bytes.slice(start, end));
	if (
		text(0, 4) !== "RIFF" ||
		text(8, 12) !== "WEBP" ||
		bytes.length > 30 * 1024 * 1024
	)
		throw new Error("Invalid display image");
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	if (view.getUint32(4, true) + 8 !== bytes.length)
		throw new Error("Invalid WebP length");
	let offset = 12;
	while (offset < bytes.length) {
		if (offset + 8 > bytes.length) throw new Error("Invalid WebP chunk");
		const type = text(offset, offset + 4);
		if (type === "EXIF" || type === "XMP ")
			throw new Error("Image metadata was not removed");
		const length = view.getUint32(offset + 4, true);
		offset += 8 + length + (length % 2);
		if (offset > bytes.length) throw new Error("Invalid WebP chunk length");
	}
}

export interface ExtractedMetadata {
	takenAt: string | null;
	latitude: number | null;
	longitude: number | null;
	camera: Camera | null;
}
/** "2025:12:03 20:13:59" + optional "-05:00" -> ISO instant. Without an offset, wall-clock time is kept as UTC. */
export function exifDate(value: unknown, offset: unknown) {
	if (typeof value !== "string") return null;
	const match = value.match(
		/^(\d{4}):(\d{2}):(\d{2})[ T](\d{2}):(\d{2}):(\d{2})/,
	);
	if (!match) return null;
	const zone =
		typeof offset === "string" && /^[+-]\d{2}:\d{2}$/.test(offset)
			? offset
			: "Z";
	const date = new Date(
		`${match[1]}-${match[2]}-${match[3]}T${match[4]}:${match[5]}:${match[6]}${zone}`,
	);
	return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}
function gpsDecimal(value: unknown, ref: unknown) {
	const parts = Array.isArray(value) ? value : [value];
	if (
		!parts.length ||
		!parts.every((part) => typeof part === "number" && Number.isFinite(part))
	)
		return null;
	const [degrees, minutes = 0, seconds = 0] = parts as number[];
	const decimal = degrees + minutes / 60 + seconds / 3600;
	return ref === "S" || ref === "W" ? -decimal : decimal;
}
/** Reads capture time, GPS and camera from the original before variants strip all metadata. */
export async function extractMetadata(
	bytes: ArrayBuffer,
): Promise<ExtractedMetadata> {
	const empty = {
		takenAt: null,
		latitude: null,
		longitude: null,
		camera: null,
	};
	const start = new Uint8Array(bytes, 0, Math.min(bytes.byteLength, 2));
	// Camera EXIF is JPEG; exifr leaks unhandled rejections on formats it can't read.
	if (start[0] !== 0xff || start[1] !== 0xd8) return empty;
	let exif: Record<string, unknown> | undefined;
	try {
		// Raw values: revived dates would depend on the runtime's time zone.
		exif = await exifr.parse(bytes, {
			reviveValues: false,
			pick: [
				"DateTimeOriginal",
				"OffsetTimeOriginal",
				"CreateDate",
				"Make",
				"Model",
				"LensModel",
				"FNumber",
				"ExposureTime",
				"ISO",
				"GPSLatitude",
				"GPSLongitude",
				"GPSLatitudeRef",
				"GPSLongitudeRef",
			],
		});
	} catch {
		return empty;
	}
	if (!exif) return empty;
	const number = (value: unknown) =>
		typeof value === "number" && Number.isFinite(value) ? value : null;
	const text = (value: unknown) =>
		typeof value === "string" && value.trim()
			? value.trim().slice(0, 100)
			: null;
	const latitude = gpsDecimal(exif.GPSLatitude, exif.GPSLatitudeRef);
	const longitude = gpsDecimal(exif.GPSLongitude, exif.GPSLongitudeRef);
	const hasGps =
		latitude !== null &&
		longitude !== null &&
		Math.abs(latitude) <= 90 &&
		Math.abs(longitude) <= 180;
	const camera = {
		make: text(exif.Make),
		model: text(exif.Model),
		lens: text(exif.LensModel),
		fNumber: number(exif.FNumber),
		exposureTime: number(exif.ExposureTime),
		iso: number(exif.ISO),
	};
	return {
		takenAt:
			exifDate(exif.DateTimeOriginal, exif.OffsetTimeOriginal) ??
			exifDate(exif.CreateDate, null),
		latitude: hasGps ? latitude : null,
		longitude: hasGps ? longitude : null,
		camera: Object.values(camera).some((value) => value !== null)
			? camera
			: null,
	};
}

const variantSpecs: Record<PhotoVariant, { size: number; quality: number }> = {
	display: { size: 2048, quality: 85 },
	thumb: { size: 480, quality: 78 },
};
export async function processPhoto(env: Env, id: string) {
	const generation = crypto.randomUUID();
	const timestamp = now();
	const leaseUntil = new Date(Date.now() + 5 * 60_000).toISOString();
	const claimed = await statement(
		env,
		`UPDATE photos SET state='processing',generation=?,lease_until=?,attempts=attempts+1,updated_at=?
		WHERE id=? AND attempts<5 AND (state='queued' OR (state='processing' AND lease_until < ?)) RETURNING *`,
		generation,
		leaseUntil,
		timestamp,
		id,
		timestamp,
	).first<PhotoRow>();
	if (!claimed) return;
	const keys = {
		display: variantKey(id, generation, "display"),
		thumb: variantKey(id, generation, "thumb"),
	};
	const original = async () => {
		const object = await env.PHOTOS.get(originalKey(id));
		if (!object || object.size !== claimed.byte_size)
			throw new Error("Original missing or incorrect size");
		return object;
	};
	try {
		const info = await env.IMAGES.info((await original()).body);
		if (
			!("width" in info) ||
			!info.width ||
			!info.height ||
			info.width * info.height > 40_000_000
		)
			throw new Error("Unsupported image or image exceeds 40 megapixels");
		const formats: Record<string, string> = {
			jpeg: "image/jpeg",
			jpg: "image/jpeg",
			png: "image/png",
			webp: "image/webp",
			avif: "image/avif",
		};
		const detectedType = info.format.startsWith("image/")
			? info.format.toLowerCase()
			: formats[info.format.toLowerCase()];
		if (detectedType !== claimed.mime_type)
			throw new Error("Image content does not match its type");
		// EXIF lives in the first segments of the file; avoid reading large originals twice.
		const head = await env.PHOTOS.get(originalKey(id), {
			range: { offset: 0, length: 512 * 1024 },
		});
		const metadata = head
			? await extractMetadata(await head.arrayBuffer())
			: await extractMetadata(new ArrayBuffer(0));
		for (const variant of ["display", "thumb"] as const) {
			const { size, quality } = variantSpecs[variant];
			const output = await env.IMAGES.input((await original()).body)
				.transform({ width: size, height: size, fit: "scale-down" })
				.output({ format: "image/webp", quality, anim: false });
			const bytes = new Uint8Array(await output.response().arrayBuffer());
			assertSafeWebp(bytes);
			await env.PHOTOS.put(keys[variant], bytes, {
				httpMetadata: { contentType: "image/webp" },
			});
		}
		// Existing values win: imported or edited metadata is never overwritten by EXIF.
		const changed = await statement(
			env,
			`UPDATE photos SET state='ready',width=?,height=?,error=NULL,lease_until=NULL,updated_at=?,
			taken_at=COALESCE(taken_at,?),latitude=COALESCE(latitude,?),longitude=COALESCE(longitude,?),camera=COALESCE(camera,?)
			WHERE id=? AND generation=? AND state='processing'`,
			info.width,
			info.height,
			now(),
			metadata.takenAt,
			metadata.latitude,
			metadata.longitude,
			metadata.camera ? JSON.stringify(metadata.camera) : null,
			id,
			generation,
		).run();
		if (!changed.meta.changes) {
			await env.PHOTOS.delete(Object.values(keys));
			return;
		}
		await deleteVariants(env, id, generation);
	} catch {
		await env.PHOTOS.delete(Object.values(keys));
		await statement(
			env,
			"UPDATE photos SET state=?,error=?,lease_until=NULL,updated_at=? WHERE id=? AND generation=? AND state='processing'",
			claimed.attempts >= 5 ? "failed" : "queued",
			"Image processing failed. Retry or choose a JPEG, PNG, WebP, or AVIF image under 40 megapixels.",
			now(),
			id,
			generation,
		).run();
		throw new Error(`Photo processing failed: ${id}`);
	}
}

/** Deletes every variant of a photo except the given generation's. Returns false if more remain. */
async function deleteVariants(env: Env, id: string, keep?: string) {
	const listed = await env.PHOTOS.list({ prefix: `display/${id}/` });
	const stale = listed.objects
		.map((object) => object.key)
		.filter((key) => !keep || !key.startsWith(`display/${id}/${keep}`));
	if (stale.length) await env.PHOTOS.delete(stale);
	return !listed.truncated;
}

export async function recoverPhotos(env: Env) {
	const timestamp = now();
	// Exhausted leases become visible failures, not permanently spinning jobs.
	await statement(
		env,
		"UPDATE photos SET state='failed',error='Processing interrupted. Retry this photo.',lease_until=NULL,updated_at=? WHERE state='processing' AND lease_until<? AND attempts>=5",
		timestamp,
		timestamp,
	).run();
	const recover = await statement(
		env,
		"SELECT id FROM photos WHERE state='queued' OR (state='processing' AND lease_until<?) ORDER BY updated_at LIMIT 100",
		timestamp,
	).all<{ id: string }>();
	for (const row of recover.results) await dispatchPhoto(env, row.id);
	// Abandoned uploads only. Ready photos stay in the library until deleted there or unlinked.
	const cutoff = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
	await statement(
		env,
		"UPDATE photos SET state='deleting',updated_at=? WHERE updated_at<? AND state IN ('pending','failed') AND NOT EXISTS(SELECT 1 FROM photo_links WHERE photo_id=photos.id)",
		timestamp,
		cutoff,
	).run();
	const deleting = await statement(
		env,
		"SELECT * FROM photos WHERE state='deleting' ORDER BY updated_at LIMIT 100",
	).all<PhotoRow>();
	for (const row of deleting.results) {
		// Keep the tombstone until all object deletions succeed; uploads can finish late.
		await env.PHOTOS.delete(originalKey(row.id));
		const complete = await deleteVariants(env, row.id);
		if (
			complete &&
			row.updated_at < new Date(Date.now() - 60 * 60_000).toISOString()
		)
			await statement(
				env,
				"DELETE FROM photos WHERE id=? AND state='deleting' AND NOT EXISTS(SELECT 1 FROM photo_links WHERE photo_id=?)",
				row.id,
				row.id,
			).run();
	}
}

async function variantObject(env: Env, row: PhotoRow, variant: PhotoVariant) {
	if (row.state !== "ready" || !row.generation)
		throw new ApiError(409, "NOT_READY", "Photo is not ready");
	const object = await env.PHOTOS.get(
		variantKey(row.id, row.generation, variant),
	);
	if (!object) throw new ApiError(404, "NOT_FOUND", "Photo variant is missing");
	return object;
}
export async function privateVariant(
	env: Env,
	id: string,
	variant: PhotoVariant,
) {
	const object = await variantObject(env, await photoRow(env, id), variant);
	return new Response(object.body, {
		headers: { "Content-Type": "image/webp" },
	});
}

const publicPath =
	/^\/public\/photos\/([^/]+)\/([0-9a-f-]{36})\/(display|thumb)\.webp$/;
/** Unauthenticated, immutable variants of public photos. The generation in the URL busts caches. */
export async function publicVariant(env: Env, path: string) {
	const match = path.match(publicPath);
	const notFound = () =>
		new Response("Not found", {
			status: 404,
			headers: { "Cache-Control": "public, max-age=60" },
		});
	if (!match || !idSchema.safeParse(match[1]).success) return notFound();
	const row = await statement(
		env,
		"SELECT * FROM photos WHERE id = ? AND visibility = 'public' AND state = 'ready' AND generation = ?",
		match[1],
		match[2],
	).first<PhotoRow>();
	if (!row) return notFound();
	const object = await env.PHOTOS.get(
		variantKey(row.id, match[2], match[3] as PhotoVariant),
	);
	if (!object) return notFound();
	return new Response(object.body, {
		headers: {
			"Content-Type": "image/webp",
			"Cache-Control": "public, max-age=31536000, immutable",
			"X-Content-Type-Options": "nosniff",
		},
	});
}
