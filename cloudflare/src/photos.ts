import { z } from "zod";
import { idSchema } from "../../shared/common";
import {
	type Camera,
	type CompletePhotoInput,
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
	variantPrefix,
	variantTypes,
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
	generation: string | null;
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
	generation: row.generation,
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
/** D1 binds at most 100 parameters per query, so long IN lists are queried in chunks. */
async function allInChunks<T>(
	ids: string[],
	query: (chunk: string[]) => Promise<T[]>,
) {
	const rows: T[] = [];
	for (let i = 0; i < ids.length; i += 90)
		rows.push(...(await query(ids.slice(i, i + 90))));
	return rows;
}

/** Photos linked to each context id, in link order. One query for any number of ids. */
export async function linkedPhotos(
	env: Env,
	context: PhotoContext,
	contextIds: string[],
) {
	const byContext = new Map<string, Photo[]>(contextIds.map((id) => [id, []]));
	if (!contextIds.length) return byContext;
	const results = await allInChunks(contextIds, async (chunk) => {
		const { results } = await statement(
			env,
			`SELECT p.*, l.context_id AS link_context_id FROM photo_links l JOIN photos p ON p.id = l.photo_id
			WHERE l.context = ? AND l.context_id IN (${placeholders(chunk.length)}) ORDER BY l.position`,
			context,
			...chunk,
		).all<PhotoRow & { link_context_id: string }>();
		return results;
	});
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
		"INSERT INTO photos(id,file_name,mime_type,byte_size,state,generation,created_at,updated_at) VALUES (?,?,?,?,'pending',?,?,?) ON CONFLICT(id) DO NOTHING",
		data.id,
		data.fileName,
		data.mimeType,
		data.byteSize,
		crypto.randomUUID(),
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
		const rows = await allInChunks(
			page.map((row) => row.id),
			async (chunk) => {
				const { results } = await statement(
					env,
					`SELECT * FROM photo_links WHERE photo_id IN (${placeholders(chunk.length)}) ORDER BY context, context_id`,
					...chunk,
				).all<LinkRow>();
				return results;
			},
		);
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

/**
 * The browser uploads the original plus display/thumb variants it resized itself (canvas
 * encoding drops EXIF/GPS). Completing checks all three objects and records the metadata it read.
 */
export async function completePhoto(
	env: Env,
	id: string,
	input: CompletePhotoInput,
) {
	const row = await photoRow(env, id);
	if (row.state === "ready") return photoDto(row);
	if (row.state === "deleting" || !row.generation)
		throw new ApiError(409, "CONFLICT", "Photo is being removed");
	const [original, ...variants] = await Promise.all([
		env.PHOTOS.head(originalKey(id)),
		env.PHOTOS.head(variantKey(id, row.generation, "display")),
		env.PHOTOS.head(variantKey(id, row.generation, "thumb")),
	]);
	if (!original || variants.some((object) => !object))
		throw new ApiError(
			409,
			"UPLOAD_MISSING",
			"Upload is not complete. Retry the file upload.",
		);
	if (
		original.size !== row.byte_size ||
		original.httpMetadata?.contentType !== row.mime_type ||
		!variants.every((object) =>
			(variantTypes as readonly string[]).includes(
				object?.httpMetadata?.contentType ?? "",
			),
		)
	)
		throw new ApiError(
			400,
			"INVALID_UPLOAD",
			"Stored files do not match the declared files",
		);
	await statement(
		env,
		`UPDATE photos SET state='ready',width=?,height=?,taken_at=?,latitude=?,longitude=?,camera=?,updated_at=?
		WHERE id=? AND state='pending'`,
		input.width,
		input.height,
		input.takenAt,
		input.latitude,
		input.longitude,
		input.camera ? JSON.stringify(input.camera) : null,
		now(),
		id,
	).run();
	return photoDto(await photoRow(env, id));
}

/** Deletes every variant of a photo. Returns false if more remain. */
async function deleteVariants(env: Env, id: string) {
	const listed = await env.PHOTOS.list({ prefix: variantPrefix(id) });
	const keys = listed.objects.map((object) => object.key);
	if (keys.length) await env.PHOTOS.delete(keys);
	return !listed.truncated;
}

export async function cleanupPhotos(env: Env) {
	const timestamp = now();
	// Abandoned uploads only. Ready photos stay in the library until deleted there or unlinked.
	const cutoff = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
	await statement(
		env,
		"UPDATE photos SET state='deleting',updated_at=? WHERE updated_at<? AND state='pending' AND NOT EXISTS(SELECT 1 FROM photo_links WHERE photo_id=photos.id)",
		timestamp,
		cutoff,
	).run();
	const deleting = await statement(
		env,
		"SELECT id, updated_at FROM photos WHERE state='deleting' ORDER BY updated_at LIMIT 50",
	).all<{ id: string; updated_at: string }>();
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
		headers: { "Content-Type": object.httpMetadata?.contentType ?? "" },
	});
}

async function signature(env: Env, message: string) {
	const key = await crypto.subtle.importKey(
		"raw",
		new TextEncoder().encode(`signed-photo:${env.WORKER_API_SECRET}`),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	const mac = await crypto.subtle.sign(
		"HMAC",
		key,
		new TextEncoder().encode(message),
	);
	return Array.from(new Uint8Array(mac), (v) =>
		v.toString(16).padStart(2, "0"),
	).join("");
}
const signedTtlSeconds = 600;
/** A short-lived, unauthenticated link to a private photo, for the AI provider to fetch. */
export async function signedPhotoUrl(env: Env, origin: string, photo: Photo) {
	if (photo.state !== "ready" || !photo.generation)
		throw new ApiError(409, "NOT_READY", "Photo is not ready");
	const expires = Math.floor(Date.now() / 1000) + signedTtlSeconds;
	const path = `/signed/photos/${photo.id}/${photo.generation}/display`;
	return `${origin}${path}?expires=${expires}&sig=${await signature(env, `${path}:${expires}`)}`;
}
export async function signedVariant(env: Env, url: URL) {
	const notFound = () =>
		new Response("Not found", {
			status: 404,
			headers: { "Cache-Control": "no-store" },
		});
	const match = url.pathname.match(
		/^\/signed\/photos\/([^/]+)\/([0-9a-f-]{36})\/(display|thumb)$/,
	);
	const expires = Number(url.searchParams.get("expires"));
	const sig = url.searchParams.get("sig") ?? "";
	if (
		!match ||
		!Number.isInteger(expires) ||
		expires < Date.now() / 1000 ||
		expires > Date.now() / 1000 + signedTtlSeconds
	)
		return notFound();
	const expected = await signature(env, `${url.pathname}:${expires}`);
	let diff = expected.length ^ sig.length;
	for (let i = 0; i < expected.length; i++)
		diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
	if (diff !== 0) return notFound();
	const object = await env.PHOTOS.get(
		variantKey(match[1], match[2], match[3] as PhotoVariant),
	);
	if (!object) return notFound();
	return new Response(object.body, {
		headers: {
			"Content-Type": object.httpMetadata?.contentType ?? "",
			"Cache-Control": "private, no-store",
			"X-Content-Type-Options": "nosniff",
		},
	});
}

const publicPath =
	/^\/public\/photos\/([^/]+)\/([0-9a-f-]{36})\/(display|thumb)$/;
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
			"Content-Type": object.httpMetadata?.contentType ?? "",
			"Cache-Control": "public, max-age=31536000, immutable",
			"X-Content-Type-Options": "nosniff",
		},
	});
}
