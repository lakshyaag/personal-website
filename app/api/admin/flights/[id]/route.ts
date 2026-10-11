import { privateJson, privateRoute, readJson } from "@/lib/backend/api";
import { type IdContext, noContent, routeId } from "@/lib/backend/routes";
import { workerJson, workerRequest } from "@/lib/backend/worker";
import { flightSchema, saveFlightSchema } from "@/shared/flights";

export const runtime = "nodejs";
export function PUT(request: Request, context: IdContext) {
	return privateRoute(request, async () => {
		const id = await routeId(context);
		const input = saveFlightSchema.parse(await readJson(request));
		return privateJson(
			flightSchema.parse(
				await workerJson(`/v1/flights/${id}`, {
					method: "PUT",
					body: JSON.stringify(input),
				}),
			),
		);
	});
}
export function DELETE(request: Request, context: IdContext) {
	return privateRoute(request, async () => {
		await workerRequest(`/v1/flights/${await routeId(context)}`, {
			method: "DELETE",
		});
		return noContent();
	});
}
