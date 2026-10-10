import { privateJson, privateRoute, readJson } from "@/lib/backend/api";
import {
	type IdContext,
	analyzeLater,
	noContent,
	routeId,
} from "@/lib/backend/routes";
import { workerJson, workerRequest } from "@/lib/backend/worker";
import { saveWorkoutSchema, workoutLogSchema } from "@/shared/workouts";

export const runtime = "nodejs";
export const maxDuration = 120;
export function GET(request: Request, context: IdContext) {
	return privateRoute(request, async () =>
		privateJson(
			workoutLogSchema.parse(
				await workerJson(`/v1/workouts/${await routeId(context)}`),
			),
		),
	);
}
export function PUT(request: Request, context: IdContext) {
	return privateRoute(request, async () => {
		const id = await routeId(context);
		const input = saveWorkoutSchema.parse(await readJson(request));
		const log = workoutLogSchema.parse(
			await workerJson(`/v1/workouts/${id}`, {
				method: "PUT",
				body: JSON.stringify(input),
			}),
		);
		if (log.content && !log.aiSessionType)
			analyzeLater(`/v1/workouts/${id}/analyze`);
		return privateJson(log);
	});
}
export function DELETE(request: Request, context: IdContext) {
	return privateRoute(request, async () => {
		await workerRequest(`/v1/workouts/${await routeId(context)}`, {
			method: "DELETE",
		});
		return noContent();
	});
}
