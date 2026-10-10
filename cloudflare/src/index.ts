import { z } from "zod";
import {
	type JournalEntry,
	type JournalPhoto,
	type SaveJournalInput,
	createPhotoSchema,
	dateSchema,
	displayKey,
	idSchema,
	originalKey,
	saveJournalSchema,
} from "../../shared/journal";

export interface Env {
	DB: D1Database;
	PHOTOS: R2Bucket;
	IMAGES: ImagesBinding;
	PHOTO_QUEUE: Queue<{ id: string }>;
	WORKER_API_SECRET: string;
	LOCAL_UPLOADS?: string;
}
interface EntryRow {
	id: string;
	entry_date: string;
	content: string;
	version: number;
	created_at: string;
	updated_at: string;
	last_mutation: string;
}
interface PhotoRow {
	id: string;
	draft_entry_id: string;
	file_name: string;
	mime_type: string;
	byte_size: number;
	state: JournalPhoto["state"];
	width: number | null;
	height: number | null;
	error: string | null;
	display_key: string | null;
	generation: string | null;
	attempts: number;
	lease_until: string | null;
	created_at: string;
	updated_at: string;
}
class ApiError extends Error {
	constructor(
		public status: number,
		public code: string,
		message: string,
	) {
		super(message);
	}
}
const now = () => new Date().toISOString();
const statement = (
	env: Env,
	sql: string,
	...values: (string | number | null)[]
) => env.DB.prepare(sql).bind(...values);
const photoDto = (row: PhotoRow): JournalPhoto => ({
	id: row.id,
	entryId: row.draft_entry_id,
	fileName: row.file_name,
	mimeType: row.mime_type,
	byteSize: row.byte_size,
	state: row.state,
	width: row.width,
	height: row.height,
	error: row.error,
});
async function photoRow(env: Env, id: string) {
	const photo = await statement(
		env,
		"SELECT * FROM photos WHERE id = ?",
		id,
	).first<PhotoRow>();
	if (!photo) throw new ApiError(404, "NOT_FOUND", "Photo not found");
	return photo;
}
async function entryDto(env: Env, row: EntryRow): Promise<JournalEntry> {
	const { results } = await statement(
		env,
		"SELECT p.* FROM photos p JOIN journal_photos a ON p.id = a.photo_id WHERE a.entry_id = ? ORDER BY a.position",
		row.id,
	).all<PhotoRow>();
	return {
		id: row.id,
		date: row.entry_date,
		content: row.content,
		version: row.version,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		photos: results.map(photoDto),
	};
}
async function getEntry(env: Env, id: string) {
	const row = await statement(
		env,
		"SELECT * FROM journal_entries WHERE id = ?",
		id,
	).first<EntryRow>();
	if (!row) throw new ApiError(404, "NOT_FOUND", "Entry not found");
	return entryDto(env, row);
}
const cursorSchema = z
	.object({ date: dateSchema, createdAt: z.iso.datetime(), id: idSchema })
	.strict();
async function listEntries(env: Env, url: URL) {
	const date = url.searchParams.get("date");
	if (date) dateSchema.parse(date);
	const limit = z.coerce
		.number()
		.int()
		.min(1)
		.max(50)
		.parse(url.searchParams.get("limit") ?? 20);
	let cursor: z.infer<typeof cursorSchema> | undefined;
	if (url.searchParams.has("cursor")) {
		try {
			cursor = cursorSchema.parse(
				JSON.parse(atob(url.searchParams.get("cursor") ?? "")),
			);
		} catch {
			throw new ApiError(400, "INVALID_CURSOR", "Invalid pagination cursor");
		}
	}
	const filters: string[] = [];
	const params: (string | number)[] = [];
	if (date) {
		filters.push("entry_date = ?");
		params.push(date);
	}
	if (cursor) {
		filters.push("(entry_date, created_at, id) < (?, ?, ?)");
		params.push(cursor.date, cursor.createdAt, cursor.id);
	}
	const { results } = await statement(
		env,
		`SELECT * FROM journal_entries ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""} ORDER BY entry_date DESC, created_at DESC, id DESC LIMIT ?`,
		...params,
		limit + 1,
	).all<EntryRow>();
	const page = results.slice(0, limit);
	const last = page.at(-1);
	return {
		entries: await Promise.all(page.map((row) => entryDto(env, row))),
		nextCursor:
			results.length > limit && last
				? btoa(
						JSON.stringify({
							date: last.entry_date,
							createdAt: last.created_at,
							id: last.id,
						}),
					)
				: null,
	};
}
async function hash(value: string) {
	return Array.from(
		new Uint8Array(
			await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
		),
	)
		.map((v) => v.toString(16).padStart(2, "0"))
		.join("");
}
export async function authorized(request: Request, env: Env) {
	const secret = env.WORKER_API_SECRET;
	if (
		!secret ||
		secret.length < 32 ||
		/REPLACE|CHANGEME|placeholder/i.test(secret)
	)
		return false;
	// Fixed-length digests prevent length leaks; no early exit in the comparison.
	const [a, b] = await Promise.all([
		hash(request.headers.get("authorization") ?? ""),
		hash(`Bearer ${secret}`),
	]);
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}
async function jsonBody(request: Request) {
	if (!request.headers.get("content-type")?.startsWith("application/json"))
		throw new ApiError(415, "CONTENT_TYPE", "Use application/json");
	if (!request.body)
		throw new ApiError(400, "INVALID_JSON", "Missing JSON body");
	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		size += value.length;
		if (size > 512_000) {
			await reader.cancel();
			throw new ApiError(413, "BODY_TOO_LARGE", "Request is too large");
		}
		chunks.push(value);
	}
	const buffer = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		buffer.set(chunk, offset);
		offset += chunk.length;
	}
	try {
		return JSON.parse(new TextDecoder().decode(buffer));
	} catch {
		throw new ApiError(400, "INVALID_JSON", "Invalid JSON");
	}
}
export async function saveEntry(env: Env, input: SaveJournalInput) {
	const mutation = await hash(JSON.stringify(input));
	const previous = await statement(
		env,
		"SELECT * FROM journal_entries WHERE id = ?",
		input.id,
	).first<EntryRow>();
	if (previous?.last_mutation === mutation) return entryDto(env, previous);
	if ((previous?.version ?? 0) !== input.expectedVersion)
		throw new ApiError(
			409,
			"CONFLICT",
			"This entry changed. Reload it before saving.",
		);
	const timestamp = now();
	const assertionId = crypto.randomUUID();
	const placeholders = input.photoIds.map(() => "?").join(",");
	const statements = [
		statement(
			env,
			`INSERT INTO journal_entries (id,entry_date,content,version,created_at,updated_at,last_mutation)
			SELECT ?,?,?,1,?,?,? WHERE ? = 0 OR EXISTS(SELECT 1 FROM journal_entries WHERE id = ? AND version = ?)
			ON CONFLICT(id) DO UPDATE SET entry_date=excluded.entry_date,content=excluded.content,
			version=journal_entries.version+1,updated_at=excluded.updated_at,last_mutation=excluded.last_mutation WHERE journal_entries.version = ?`,
			input.id,
			input.date,
			input.content,
			timestamp,
			timestamp,
			mutation,
			input.expectedVersion,
			input.id,
			input.expectedVersion,
			input.expectedVersion,
		),
		statement(
			env,
			"INSERT INTO write_assertions(id,ok) VALUES (?,changes())",
			assertionId,
		),
		statement(env, "DELETE FROM write_assertions WHERE id = ?", assertionId),
	];
	if (input.photoIds.length)
		statements.push(
			statement(
				env,
				`INSERT INTO write_assertions(id,ok) SELECT ?, CASE WHEN COUNT(*) = ? THEN 1 ELSE 0 END FROM photos WHERE id IN (${placeholders}) AND draft_entry_id = ? AND state = 'ready'`,
				assertionId,
				input.photoIds.length,
				...input.photoIds,
				input.id,
			),
			statement(env, "DELETE FROM write_assertions WHERE id = ?", assertionId),
		);
	statements.push(
		statement(env, "DELETE FROM journal_photos WHERE entry_id = ?", input.id),
	);
	input.photoIds.forEach((id, index) =>
		statements.push(
			statement(
				env,
				"INSERT INTO journal_photos(entry_id,photo_id,position) VALUES (?,?,?)",
				input.id,
				id,
				index,
			),
		),
	);
	try {
		await env.DB.batch(statements);
	} catch (error) {
		// Don't convert operational database failures into conflicts.
		if (
			String(error).includes("CHECK constraint failed") ||
			String(error).includes("UNIQUE constraint failed")
		)
			throw new ApiError(
				409,
				"CONFLICT",
				"Entry changed or photos are not ready. Reload and retry.",
			);
		throw error;
	}
	return getEntry(env, input.id);
}
async function deleteEntry(env: Env, id: string, version: number) {
	const assertionId = crypto.randomUUID();
	try {
		await env.DB.batch([
			statement(
				env,
				"DELETE FROM journal_entries WHERE id = ? AND version = ?",
				id,
				version,
			),
			statement(
				env,
				"INSERT INTO write_assertions(id,ok) VALUES (?,changes())",
				assertionId,
			),
			statement(env, "DELETE FROM write_assertions WHERE id = ?", assertionId),
			statement(
				env,
				"UPDATE photos SET state='deleting',updated_at=? WHERE draft_entry_id=? AND NOT EXISTS(SELECT 1 FROM journal_photos a WHERE a.photo_id=photos.id)",
				now(),
				id,
			),
		]);
	} catch (error) {
		if (String(error).includes("CHECK constraint failed"))
			throw new ApiError(
				409,
				"CONFLICT",
				"Entry changed or was already deleted. Reload and retry.",
			);
		throw error;
	}
}
async function createPhoto(env: Env, data: z.infer<typeof createPhotoSchema>) {
	const timestamp = now();
	await statement(
		env,
		"INSERT INTO photos(id,draft_entry_id,file_name,mime_type,byte_size,state,created_at,updated_at) VALUES (?,?,?,?,?,'pending',?,?) ON CONFLICT(id) DO NOTHING",
		data.id,
		data.entryId,
		data.fileName,
		data.mimeType,
		data.byteSize,
		timestamp,
		timestamp,
	).run();
	const row = await photoRow(env, data.id);
	if (
		row.draft_entry_id !== data.entryId ||
		row.byte_size !== data.byteSize ||
		row.mime_type !== data.mimeType ||
		row.file_name !== data.fileName ||
		row.state === "deleting"
	)
		throw new ApiError(409, "CONFLICT", "Photo ID already in use");
	return photoDto(row);
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
async function completePhoto(env: Env, id: string, retry = false) {
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
	const key = displayKey(id, generation);
	try {
		const original = await env.PHOTOS.get(originalKey(id));
		if (!original || original.size !== claimed.byte_size)
			throw new Error("Original missing or incorrect size");
		const info = await env.IMAGES.info(original.body);
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
		const source = await env.PHOTOS.get(originalKey(id));
		if (!source) throw new Error("Original missing");
		const output = await env.IMAGES.input(source.body)
			.transform({ width: 1600, height: 1600, fit: "scale-down" })
			.output({ format: "image/webp", quality: 85, anim: false });
		const bytes = new Uint8Array(await output.response().arrayBuffer());
		assertSafeWebp(bytes);
		await env.PHOTOS.put(key, bytes, {
			httpMetadata: {
				contentType: "image/webp",
				cacheControl: "private, no-store",
			},
		});
		const changed = await statement(
			env,
			"UPDATE photos SET state='ready',display_key=?,width=?,height=?,error=NULL,lease_until=NULL,updated_at=? WHERE id=? AND generation=? AND state='processing'",
			key,
			info.width,
			info.height,
			now(),
			id,
			generation,
		).run();
		if (!changed.meta.changes) await env.PHOTOS.delete(key);
	} catch {
		await env.PHOTOS.delete(key);
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
	const cutoff = new Date(Date.now() - 24 * 60 * 60_000).toISOString();
	await statement(
		env,
		"UPDATE photos SET state='deleting',updated_at=? WHERE updated_at<? AND state IN ('pending','ready','failed') AND NOT EXISTS(SELECT 1 FROM journal_photos WHERE photo_id=photos.id)",
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
		const prefix = `display/${row.id}/`;
		const variants = await env.PHOTOS.list({ prefix });
		if (variants.objects.length)
			await env.PHOTOS.delete(variants.objects.map((object) => object.key));
		if (
			!variants.truncated &&
			row.updated_at < new Date(Date.now() - 60 * 60_000).toISOString()
		)
			await statement(
				env,
				"DELETE FROM photos WHERE id=? AND state='deleting' AND NOT EXISTS(SELECT 1 FROM journal_photos WHERE photo_id=?)",
				row.id,
				row.id,
			).run();
	}
}
function responseJson(data: unknown, status = 200) {
	return Response.json(data, { status });
}
async function route(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const path = url.pathname;
	if (path === "/v1/health" && request.method === "GET")
		return responseJson({ ok: true, backend: "cloudflare-journal" });
	if (path === "/v1/journal") {
		if (request.method === "GET")
			return responseJson(await listEntries(env, url));
		if (request.method === "POST")
			return responseJson(
				await saveEntry(env, saveJournalSchema.parse(await jsonBody(request))),
			);
	}
	const entryMatch = path.match(/^\/v1\/journal\/([^/]+)$/);
	if (entryMatch) {
		const id = idSchema.parse(entryMatch[1]);
		if (request.method === "GET") return responseJson(await getEntry(env, id));
		if (request.method === "DELETE") {
			await deleteEntry(
				env,
				id,
				z.coerce
					.number()
					.int()
					.positive()
					.parse(url.searchParams.get("expectedVersion")),
			);
			return new Response(null, { status: 204 });
		}
	}
	if (path === "/v1/photos" && request.method === "POST")
		return responseJson(
			await createPhoto(env, createPhotoSchema.parse(await jsonBody(request))),
			201,
		);
	const photoMatch = path.match(
		/^\/v1\/photos\/([^/]+)(?:\/(complete|retry|display|upload|original))?$/,
	);
	if (photoMatch) {
		const id = idSchema.parse(photoMatch[1]);
		const action = photoMatch[2];
		if (!action && request.method === "GET")
			return responseJson(photoDto(await photoRow(env, id)));
		if (!action && request.method === "DELETE") {
			const attached = await statement(
				env,
				"SELECT 1 FROM journal_photos WHERE photo_id=?",
				id,
			).first();
			if (attached)
				throw new ApiError(
					409,
					"ATTACHED",
					"Remove the photo from the entry and save first",
				);
			await photoRow(env, id);
			const removed = await statement(
				env,
				"UPDATE photos SET state='deleting',updated_at=? WHERE id=? AND NOT EXISTS(SELECT 1 FROM journal_photos WHERE photo_id=?)",
				now(),
				id,
				id,
			).run();
			if (!removed.meta.changes)
				throw new ApiError(
					409,
					"ATTACHED",
					"Photo was attached while removing it. Reload the entry.",
				);
			return new Response(null, { status: 204 });
		}
		if (
			(action === "complete" || action === "retry") &&
			request.method === "POST"
		)
			return responseJson(await completePhoto(env, id, action === "retry"));
		if (action === "display" && request.method === "GET") {
			const row = await photoRow(env, id);
			if (row.state !== "ready" || !row.display_key)
				throw new ApiError(409, "NOT_READY", "Photo is not ready");
			const object = await env.PHOTOS.get(row.display_key);
			if (!object)
				throw new ApiError(404, "NOT_FOUND", "Photo variant is missing");
			return new Response(object.body, {
				headers: { "Content-Type": "image/webp" },
			});
		}
		if (
			action === "upload" &&
			request.method === "PUT" &&
			env.LOCAL_UPLOADS === "true"
		) {
			const row = await photoRow(env, id);
			if (row.state !== "pending")
				throw new ApiError(409, "CONFLICT", "Upload already completed");
			const length = Number(request.headers.get("content-length"));
			if (
				length !== row.byte_size ||
				request.headers.get("content-type") !== row.mime_type
			)
				throw new ApiError(400, "INVALID_UPLOAD", "File size or type mismatch");
			if (!request.body)
				throw new ApiError(400, "INVALID_UPLOAD", "Missing file");
			const result = await env.PHOTOS.put(originalKey(id), request.body, {
				onlyIf: { etagDoesNotMatch: "*" },
				httpMetadata: { contentType: row.mime_type },
			});
			if (!result) return new Response(null, { status: 412 });
			return new Response(null, { status: 204 });
		}
	}
	throw new ApiError(404, "NOT_FOUND", "Route not found");
}
export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const requestId = crypto.randomUUID();
		let response: Response;
		try {
			if (!(await authorized(request, env)))
				throw new ApiError(401, "UNAUTHORIZED", "Unauthorized");
			response = await route(request, env);
		} catch (error) {
			if (error instanceof z.ZodError)
				response = responseJson(
					{
						error: "Invalid request",
						code: "VALIDATION",
						issues: error.issues.map((issue) => ({
							path: issue.path,
							message: issue.message,
						})),
						requestId,
					},
					400,
				);
			else if (error instanceof ApiError)
				response = responseJson(
					{ error: error.message, code: error.code, requestId },
					error.status,
				);
			else {
				console.error(JSON.stringify({ code: "INTERNAL", requestId }));
				response = responseJson(
					{ error: "Backend request failed", code: "INTERNAL", requestId },
					500,
				);
			}
		}
		response.headers.set("Cache-Control", "private, no-store");
		response.headers.set("X-Content-Type-Options", "nosniff");
		response.headers.set("X-Request-Id", requestId);
		return response;
	},
	async queue(batch: MessageBatch<{ id: string }>, env: Env) {
		for (const message of batch.messages) {
			try {
				await processPhoto(env, idSchema.parse(message.body.id));
				message.ack();
			} catch {
				message.retry({ delaySeconds: 30 });
			}
		}
	},
	async scheduled(
		_event: ScheduledController,
		env: Env,
		ctx: ExecutionContext,
	) {
		ctx.waitUntil(recoverPhotos(env));
	},
} satisfies ExportedHandler<Env, { id: string }>;
