import { privateJson, privateRoute } from "@/lib/backend/api";
import { type IdContext, analysisTimeout, routeId } from "@/lib/backend/routes";
import { workerJson } from "@/lib/backend/worker";
import { foodEntrySchema } from "@/shared/food";

export const runtime = "nodejs";
export const maxDuration = 120;
export function POST(request: Request, context: IdContext) {
	return privateRoute(request, async () =>
		privateJson(
			foodEntrySchema.parse(
				await workerJson(`/v1/food/${await routeId(context)}/analyze`, {
					method: "POST",
					signal: analysisTimeout(),
				}),
			),
		),
	);
}
