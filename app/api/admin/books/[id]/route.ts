import { privateJson, privateRoute, readJson } from "@/lib/backend/api";
import { type IdContext, noContent, routeId } from "@/lib/backend/routes";
import { workerJson, workerRequest } from "@/lib/backend/worker";
import { bookSchema, saveBookSchema } from "@/shared/books";

export const runtime = "nodejs";
export function PUT(request: Request, context: IdContext) {
	return privateRoute(request, async () => {
		const id = await routeId(context);
		const input = saveBookSchema.parse(await readJson(request));
		return privateJson(
			bookSchema.parse(
				await workerJson(`/v1/books/${id}`, {
					method: "PUT",
					body: JSON.stringify(input),
				}),
			),
		);
	});
}
export function DELETE(request: Request, context: IdContext) {
	return privateRoute(request, async () => {
		await workerRequest(`/v1/books/${await routeId(context)}`, {
			method: "DELETE",
		});
		return noContent();
	});
}
