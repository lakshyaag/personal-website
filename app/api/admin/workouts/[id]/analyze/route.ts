import { privateJson, privateRoute } from "@/lib/backend/api";
import { type IdContext, routeId } from "@/lib/backend/routes";
import { workerJson } from "@/lib/backend/worker";
import { workoutLogSchema } from "@/shared/workouts";

export const runtime = "nodejs";
export function POST(request: Request, context: IdContext) {
	return privateRoute(request, async () =>
		privateJson(
			workoutLogSchema.parse(
				await workerJson(`/v1/workouts/${await routeId(context)}/analyze`, {
					method: "POST",
				}),
			),
		),
	);
}
