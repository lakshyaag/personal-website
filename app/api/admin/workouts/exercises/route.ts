import { privateJson, privateRoute } from "@/lib/backend/api";
import { workerJson } from "@/lib/backend/worker";
import { exerciseSummaries } from "@/lib/backend/workout-stats";
import { workoutListSchema } from "@/shared/workouts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
	return privateRoute(request, async () =>
		privateJson(
			exerciseSummaries(
				workoutListSchema.parse(await workerJson("/v1/workouts")).logs,
			),
		),
	);
}
