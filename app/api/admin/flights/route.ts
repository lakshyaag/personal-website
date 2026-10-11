import { privateJson, privateRoute } from "@/lib/backend/api";
import { workerJson } from "@/lib/backend/worker";
import { flightListSchema } from "@/shared/flights";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
	return privateRoute(request, async () =>
		privateJson(flightListSchema.parse(await workerJson("/v1/flights"))),
	);
}
