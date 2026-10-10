import { z } from "zod";
import { idSchema } from "../../shared/common";
import { saveJournalSchema } from "../../shared/journal";
import {
	createPhotoSchema,
	originalKey,
	updatePhotoSchema,
} from "../../shared/photos";
import { ApiError, type Env, authorized, jsonBody, responseJson } from "./http";
import { deleteEntry, getEntry, listEntries, saveEntry } from "./journal";
import {
	completePhoto,
	createPhoto,
	deletePhoto,
	listPhotos,
	photoDto,
	photoRow,
	privateVariant,
	processPhoto,
	publicVariant,
	recoverPhotos,
	updatePhoto,
} from "./photos";

export type { Env } from "./http";
export { authorized } from "./http";
export { saveEntry } from "./journal";
export { assertSafeWebp, processPhoto, recoverPhotos } from "./photos";

const expectedVersion = (url: URL) =>
	z.coerce
		.number()
		.int()
		.positive()
		.parse(url.searchParams.get("expectedVersion"));

async function route(request: Request, env: Env): Promise<Response> {
	const url = new URL(request.url);
	const path = url.pathname;
	const method = request.method;
	if (path === "/v1/health" && method === "GET")
		return responseJson({ ok: true });

	if (path === "/v1/journal") {
		if (method === "GET") return responseJson(await listEntries(env, url));
		if (method === "POST")
			return responseJson(
				await saveEntry(env, saveJournalSchema.parse(await jsonBody(request))),
			);
	}
	const entry = path.match(/^\/v1\/journal\/([^/]+)$/);
	if (entry) {
		const id = idSchema.parse(entry[1]);
		if (method === "GET") return responseJson(await getEntry(env, id));
		if (method === "DELETE") {
			await deleteEntry(env, id, expectedVersion(url));
			return new Response(null, { status: 204 });
		}
	}

	if (path === "/v1/photos") {
		if (method === "GET") return responseJson(await listPhotos(env, url));
		if (method === "POST")
			return responseJson(
				await createPhoto(
					env,
					createPhotoSchema.parse(await jsonBody(request)),
				),
				201,
			);
	}
	const photo = path.match(
		/^\/v1\/photos\/([^/]+)(?:\/(complete|retry|display|thumb|upload))?$/,
	);
	if (photo) {
		const id = idSchema.parse(photo[1]);
		const action = photo[2];
		if (!action && method === "GET")
			return responseJson(photoDto(await photoRow(env, id)));
		if (!action && method === "PATCH")
			return responseJson(
				await updatePhoto(
					env,
					id,
					updatePhotoSchema.parse(await jsonBody(request)),
				),
			);
		if (!action && method === "DELETE") {
			await deletePhoto(env, id);
			return new Response(null, { status: 204 });
		}
		if ((action === "complete" || action === "retry") && method === "POST")
			return responseJson(await completePhoto(env, id, action === "retry"));
		if ((action === "display" || action === "thumb") && method === "GET")
			return privateVariant(env, id, action);
		if (action === "upload" && method === "PUT" && env.LOCAL_UPLOADS === "true")
			return localUpload(request, env, id);
	}
	throw new ApiError(404, "NOT_FOUND", "Route not found");
}

/** Local development only: Next.js proxies uploads here instead of presigned R2 URLs. */
async function localUpload(request: Request, env: Env, id: string) {
	const row = await photoRow(env, id);
	if (row.state !== "pending")
		throw new ApiError(409, "CONFLICT", "Upload already completed");
	const length = Number(request.headers.get("content-length"));
	if (
		length !== row.byte_size ||
		request.headers.get("content-type") !== row.mime_type
	)
		throw new ApiError(400, "INVALID_UPLOAD", "File size or type mismatch");
	if (!request.body) throw new ApiError(400, "INVALID_UPLOAD", "Missing file");
	const result = await env.PHOTOS.put(originalKey(id), request.body, {
		onlyIf: { etagDoesNotMatch: "*" },
		httpMetadata: { contentType: row.mime_type },
	});
	if (!result) return new Response(null, { status: 412 });
	return new Response(null, { status: 204 });
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const path = new URL(request.url).pathname;
		if (path.startsWith("/public/") && request.method === "GET")
			return publicVariant(env, path);
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
