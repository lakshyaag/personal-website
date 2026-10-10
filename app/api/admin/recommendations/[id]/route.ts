import { privateRoute } from "@/lib/backend/api";
import { type IdContext, noContent, routeId } from "@/lib/backend/routes";
import { workerRequest } from "@/lib/backend/worker";

export const runtime = "nodejs";
export function DELETE(request: Request, context: IdContext) {
	return privateRoute(request, async () => {
		await workerRequest(`/v1/recommendations/${await routeId(context)}`, {
			method: "DELETE",
		});
		return noContent();
	});
}
