import { privateJson, privateRoute } from "@/lib/backend/api";
import { type IdContext, routeId } from "@/lib/backend/routes";
import { workerJson } from "@/lib/backend/worker";
import { bookSchema } from "@/shared/books";

export const runtime = "nodejs";
export function POST(request: Request, context: IdContext) {
	return privateRoute(request, async () =>
		privateJson(
			bookSchema.parse(
				await workerJson(`/v1/books/${await routeId(context)}/current`, {
					method: "POST",
				}),
			),
		),
	);
}
