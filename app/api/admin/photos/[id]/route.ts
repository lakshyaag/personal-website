import { privateJson, privateRoute, readJson } from "@/lib/backend/api";
import { workerJson, workerRequest } from "@/lib/backend/worker";
import { idSchema } from "@/shared/common";
import { photoSchema, updatePhotoSchema } from "@/shared/photos";

type Context = { params: Promise<{ id: string }> };
export const runtime = "nodejs";
export function GET(request: Request, context: Context) {
	return privateRoute(request, async () =>
		privateJson(
			photoSchema.parse(
				await workerJson(
					`/v1/photos/${idSchema.parse((await context.params).id)}`,
				),
			),
		),
	);
}
export function PATCH(request: Request, context: Context) {
	return privateRoute(request, async () => {
		const id = idSchema.parse((await context.params).id);
		const input = updatePhotoSchema.parse(await readJson(request));
		return privateJson(
			photoSchema.parse(
				await workerJson(`/v1/photos/${id}`, {
					method: "PATCH",
					body: JSON.stringify(input),
				}),
			),
		);
	});
}
export function DELETE(request: Request, context: Context) {
	return privateRoute(request, async () => {
		await workerRequest(
			`/v1/photos/${idSchema.parse((await context.params).id)}`,
			{ method: "DELETE" },
		);
		return new Response(null, {
			status: 204,
			headers: { "Cache-Control": "no-store" },
		});
	});
}
