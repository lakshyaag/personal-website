import { privateJson, privateRoute } from "@/lib/backend/api";
import { workerJson } from "@/lib/backend/worker";
import { visitListSchema } from "@/shared/visits";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
	return privateRoute(request, async () =>
		privateJson(visitListSchema.parse(await workerJson("/v1/visits"))),
	);
}
