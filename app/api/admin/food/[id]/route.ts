import { privateJson, privateRoute, readJson } from "@/lib/backend/api";
import {
	type IdContext,
	analyzeLater,
	noContent,
	routeId,
} from "@/lib/backend/routes";
import { workerJson, workerRequest } from "@/lib/backend/worker";
import { foodEntrySchema, saveFoodSchema } from "@/shared/food";

export const runtime = "nodejs";
export const maxDuration = 120;
export function GET(request: Request, context: IdContext) {
	return privateRoute(request, async () =>
		privateJson(
			foodEntrySchema.parse(
				await workerJson(`/v1/food/${await routeId(context)}`),
			),
		),
	);
}
export function PUT(request: Request, context: IdContext) {
	return privateRoute(request, async () => {
		const id = await routeId(context);
		const input = saveFoodSchema.parse(await readJson(request));
		const entry = foodEntrySchema.parse(
			await workerJson(`/v1/food/${id}`, {
				method: "PUT",
				body: JSON.stringify(input),
			}),
		);
		if (!entry.aiFoodName) analyzeLater(`/v1/food/${id}/analyze`);
		return privateJson(entry);
	});
}
export function DELETE(request: Request, context: IdContext) {
	return privateRoute(request, async () => {
		await workerRequest(`/v1/food/${await routeId(context)}`, {
			method: "DELETE",
		});
		return noContent();
	});
}
