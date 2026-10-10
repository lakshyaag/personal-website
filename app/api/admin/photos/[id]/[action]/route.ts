import { privateJson, privateRoute, readJson } from "@/lib/backend/api";
import { localWorkerUploads } from "@/lib/backend/config";
import { BackendError, workerJson, workerRequest } from "@/lib/backend/worker";
import { idSchema } from "@/shared/common";
import {
	MAX_PHOTO_BYTES,
	completePhotoSchema,
	photoSchema,
} from "@/shared/photos";
import { z } from "zod";

type Context = { params: Promise<{ id: string; action: string }> };
export const runtime = "nodejs";
export function POST(request: Request, context: Context) {
	return privateRoute(request, async () => {
		const { id, action } = await context.params;
		if (action !== "complete") throw new BackendError(404, "Not found");
		const input = completePhotoSchema.parse(await readJson(request));
		return privateJson(
			photoSchema.parse(
				await workerJson(`/v1/photos/${idSchema.parse(id)}/complete`, {
					method: "POST",
					body: JSON.stringify(input),
				}),
			),
		);
	});
}
export function GET(request: Request, context: Context) {
	return privateRoute(request, async () => {
		const { id, action } = await context.params;
		if (action !== "display" && action !== "thumb")
			throw new BackendError(404, "Not found");
		const response = await workerRequest(
			`/v1/photos/${idSchema.parse(id)}/${action}`,
		);
		return new Response(response.body, {
			headers: {
				"Content-Type": response.headers.get("content-type") ?? "image/webp",
				"Cache-Control": "private, no-store",
				"X-Content-Type-Options": "nosniff",
				"Content-Disposition": "inline",
			},
		});
	});
}
export function PUT(request: Request, context: Context) {
	return privateRoute(request, async () => {
		const { id, action } = await context.params;
		const file = action.match(/^upload-(original|display|thumb)$/)?.[1];
		if (!file || !localWorkerUploads())
			throw new BackendError(404, "Local upload route is disabled");
		const length = z.coerce
			.number()
			.int()
			.positive()
			.max(MAX_PHOTO_BYTES)
			.parse(request.headers.get("content-length"));
		await workerRequest(`/v1/photos/${idSchema.parse(id)}/upload/${file}`, {
			method: "PUT",
			body: request.body,
			headers: {
				"Content-Type": request.headers.get("content-type") ?? "",
				"Content-Length": String(length),
			},
		});
		return new Response(null, {
			status: 204,
			headers: { "Cache-Control": "no-store" },
		});
	});
}
