import { z } from "zod";
import { createRecommendationSchema, saveBookSchema } from "../../shared/books";
import { idSchema } from "../../shared/common";
import { saveFoodSchema } from "../../shared/food";
import { saveJournalSchema } from "../../shared/journal";
import {
	completePhotoSchema,
	createPhotoSchema,
	originalKey,
	updatePhotoSchema,
	variantKey,
} from "../../shared/photos";
import { saveVisitSchema } from "../../shared/visits";
import { saveWorkoutSchema } from "../../shared/workouts";
import { type AnalysisJob, consumeAnalysis, queueAnalysis } from "./analysis";
import {
	createRecommendation,
	deleteBook,
	deleteRecommendation,
	listBooks,
	listRecommendations,
	saveBook,
	setCurrentBook,
} from "./books";
import { analyzeFood, deleteFood, getFood, listFood, saveFood } from "./food";
import { ApiError, type Env, authorized, jsonBody, responseJson } from "./http";
import { deleteEntry, getEntry, listEntries, saveEntry } from "./journal";
import {
	cleanupPhotos,
	completePhoto,
	createPhoto,
	deletePhoto,
	listPhotos,
	photoDto,
	photoRow,
	privateVariant,
	publicVariant,
	signedVariant,
	updatePhoto,
} from "./photos";
import { deleteVisit, getVisit, listVisits, saveVisit } from "./visits";
import {
	analyzeWorkout,
	deleteWorkout,
	getWorkout,
	listWorkouts,
	saveWorkout,
} from "./workouts";

export type { Env } from "./http";
export { authorized } from "./http";
export { saveEntry } from "./journal";
export { cleanupPhotos } from "./photos";

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
		/^\/v1\/photos\/([^/]+)(?:\/(complete|display|thumb|upload\/original|upload\/display|upload\/thumb))?$/,
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
		if (action === "complete" && method === "POST")
			return responseJson(
				await completePhoto(
					env,
					id,
					completePhotoSchema.parse(await jsonBody(request)),
				),
			);
		if ((action === "display" || action === "thumb") && method === "GET")
			return privateVariant(env, id, action);
		if (
			action?.startsWith("upload/") &&
			method === "PUT" &&
			env.LOCAL_UPLOADS === "true"
		)
			return localUpload(request, env, id, action.slice("upload/".length));
	}
	const records = await recordRoute(request, env, url);
	if (records) return records;
	throw new ApiError(404, "NOT_FOUND", "Route not found");
}

const noContent = () => new Response(null, { status: 204 });
/** Food, workouts, visits, books and recommendations: list, then get/put/delete by id. */
async function recordRoute(request: Request, env: Env, url: URL) {
	const method = request.method;
	const match = url.pathname.match(
		/^\/v1\/(food|workouts|visits|books|recommendations)(?:\/([^/]+)(?:\/(analyze|current))?)?$/,
	);
	if (!match) return null;
	const [, resource, rawId, action] = match;
	if (!rawId) {
		if (
			method !== "GET" &&
			!(resource === "recommendations" && method === "POST")
		)
			return null;
		if (resource === "food") return responseJson(await listFood(env, url));
		if (resource === "workouts")
			return responseJson(await listWorkouts(env, url));
		if (resource === "visits") return responseJson(await listVisits(env));
		if (resource === "books") return responseJson(await listBooks(env));
		if (method === "POST")
			return responseJson(
				await createRecommendation(
					env,
					createRecommendationSchema.parse(await jsonBody(request)),
				),
				201,
			);
		return responseJson(await listRecommendations(env));
	}
	const id = idSchema.parse(rawId);
	if (action) {
		if (method !== "POST") return null;
		if (resource === "food" && action === "analyze")
			return responseJson(await analyzeFood(env, id, url.origin));
		if (resource === "workouts" && action === "analyze")
			return responseJson(await analyzeWorkout(env, id));
		if (resource === "books" && action === "current")
			return responseJson(await setCurrentBook(env, id));
		return null;
	}
	if (method === "GET") {
		if (resource === "food") return responseJson(await getFood(env, id));
		if (resource === "workouts") return responseJson(await getWorkout(env, id));
		if (resource === "visits") return responseJson(await getVisit(env, id));
	}
	if (method === "PUT") {
		const body = await jsonBody(request);
		if (resource === "food") {
			const entry = await saveFood(env, id, saveFoodSchema.parse(body));
			if (!entry.aiFoodName)
				await queueAnalysis(env, { kind: "food", id, origin: url.origin });
			return responseJson(entry);
		}
		if (resource === "workouts") {
			const log = await saveWorkout(env, id, saveWorkoutSchema.parse(body));
			if (log.content && !log.aiSessionType)
				await queueAnalysis(env, { kind: "workouts", id, origin: url.origin });
			return responseJson(log);
		}
		if (resource === "visits")
			return responseJson(
				await saveVisit(env, id, saveVisitSchema.parse(body)),
			);
		if (resource === "books")
			return responseJson(await saveBook(env, id, saveBookSchema.parse(body)));
	}
	if (method === "DELETE") {
		if (resource === "food") await deleteFood(env, id);
		else if (resource === "workouts") await deleteWorkout(env, id);
		else if (resource === "visits") await deleteVisit(env, id);
		else if (resource === "books") await deleteBook(env, id);
		else await deleteRecommendation(env, id);
		return noContent();
	}
	return null;
}

/** Local development only: Next.js proxies uploads here instead of presigned R2 URLs. */
async function localUpload(
	request: Request,
	env: Env,
	id: string,
	file: string,
) {
	const row = await photoRow(env, id);
	if (row.state !== "pending" || !row.generation)
		throw new ApiError(409, "CONFLICT", "Upload already completed");
	const contentType = request.headers.get("content-type") ?? "";
	const length = Number(request.headers.get("content-length"));
	const original = file === "original";
	if (
		original
			? length !== row.byte_size || contentType !== row.mime_type
			: !["image/webp", "image/jpeg"].includes(contentType) || !length
	)
		throw new ApiError(400, "INVALID_UPLOAD", "File size or type mismatch");
	if (!request.body) throw new ApiError(400, "INVALID_UPLOAD", "Missing file");
	const key = original
		? originalKey(id)
		: variantKey(id, row.generation, file === "thumb" ? "thumb" : "display");
	const result = await env.PHOTOS.put(key, request.body, {
		onlyIf: { etagDoesNotMatch: "*" },
		httpMetadata: { contentType },
	});
	if (!result) return new Response(null, { status: 412 });
	return new Response(null, { status: 204 });
}

export default {
	async fetch(request: Request, env: Env): Promise<Response> {
		const path = new URL(request.url).pathname;
		if (
			path.startsWith("/public/") &&
			(request.method === "GET" || request.method === "HEAD")
		)
			return publicVariant(env, path);
		if (path.startsWith("/signed/") && request.method === "GET")
			return signedVariant(env, new URL(request.url));
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
	queue: (batch, env) => consumeAnalysis(batch, env),
	async scheduled(
		_event: ScheduledController,
		env: Env,
		ctx: ExecutionContext,
	) {
		ctx.waitUntil(cleanupPhotos(env));
	},
} satisfies ExportedHandler<Env, AnalysisJob>;
