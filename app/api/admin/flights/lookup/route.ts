import { privateJson, privateRoute } from "@/lib/backend/api";
import { workerJson } from "@/lib/backend/worker";
import { flightLookupQuerySchema, flightLookupSchema } from "@/shared/flights";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** Costs AeroDataBox units on every call; the admin form only calls it on "Look up". */
export function GET(request: Request) {
	return privateRoute(request, async () => {
		const query = flightLookupQuerySchema.parse(
			Object.fromEntries(new URL(request.url).searchParams),
		);
		return privateJson(
			flightLookupSchema.parse(
				await workerJson(`/v1/flights/lookup?${new URLSearchParams(query)}`),
			),
		);
	});
}
