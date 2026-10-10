import { privateJson, privateRoute, readJson } from "@/lib/backend/api";
import { workerJson } from "@/lib/backend/worker";
import {
	entrySchema,
	journalListSchema,
	saveJournalSchema,
} from "@/shared/journal";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export function GET(request: Request) {
	return privateRoute(request, async () => {
		const source = new URL(request.url);
		const query = new URLSearchParams();
		for (const key of ["date", "cursor", "limit"]) {
			const value = source.searchParams.get(key);
			if (value) query.set(key, value);
		}
		return privateJson(
			journalListSchema.parse(await workerJson(`/v1/journal?${query}`)),
		);
	});
}
export function POST(request: Request) {
	return privateRoute(request, async () => {
		const input = saveJournalSchema.parse(await readJson(request));
		return privateJson(
			entrySchema.parse(
				await workerJson("/v1/journal", {
					method: "POST",
					body: JSON.stringify(input),
				}),
			),
		);
	});
}
