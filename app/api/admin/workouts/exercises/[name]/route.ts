import { privateJson, privateRoute } from "@/lib/backend/api";
import { workerJson } from "@/lib/backend/worker";
import { exerciseHistory } from "@/lib/backend/workout-stats";
import { workoutListSchema } from "@/shared/workouts";
import { z } from "zod";

export const runtime = "nodejs";
export function GET(
	request: Request,
	context: { params: Promise<{ name: string }> },
) {
	return privateRoute(request, async () => {
		const name = z
			.string()
			.min(1)
			.max(200)
			.parse((await context.params).name);
		return privateJson(
			exerciseHistory(
				workoutListSchema.parse(await workerJson("/v1/workouts")).logs,
				name,
			),
		);
	});
}
