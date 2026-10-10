import { privateJson, privateRoute } from "@/lib/backend/api";
import { workerJson } from "@/lib/backend/worker";
import { dateSchema } from "@/shared/common";
import { workoutListSchema } from "@/shared/workouts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
	return privateRoute(request, async () => {
		const date = new URL(request.url).searchParams.get("date");
		const query = date ? `?date=${dateSchema.parse(date)}` : "";
		return privateJson(
			workoutListSchema.parse(await workerJson(`/v1/workouts${query}`)),
		);
	});
}
