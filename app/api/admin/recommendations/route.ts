import { privateJson, privateRoute } from "@/lib/backend/api";
import { workerJson } from "@/lib/backend/worker";
import { recommendationListSchema } from "@/shared/books";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
	return privateRoute(request, async () =>
		privateJson(
			recommendationListSchema.parse(await workerJson("/v1/recommendations")),
		),
	);
}
