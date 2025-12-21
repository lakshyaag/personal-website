import { analyzeWorkoutEntry } from "@/lib/workout-analysis-server";
import { after } from "next/server";

export const maxDuration = 60;

export async function POST(req: Request) {
	const secret = req.headers.get("x-webhook-secret");

	if (secret !== process.env.WEBHOOK_SECRET) {
		console.error("[Workout Webhook] Unauthorized access attempt");
		return new Response("Unauthorized", { status: 401 });
	}

	try {
		const payload = await req.json();

		const { type, record } = payload;
		const entryId = record?.id;

		if (!entryId) {
			console.error("[Workout Webhook] Missing record ID in payload");
			return new Response("Missing Entry ID", { status: 400 });
		}

		console.log(
			`[Workout Webhook] Triggering analysis for entry: ${entryId} (${type})`,
		);

		after(async () => {
			try {
				await analyzeWorkoutEntry(entryId);
			} catch (err) {
				console.error(
					`[Background Workout AI Analysis Error for ${entryId}]:`,
					err,
				);
			}
		});

		return new Response(`Accepted ${entryId} for processing`, { status: 202 });
	} catch (error) {
		console.error("[Workout Webhook Error]:", error);
		return new Response(
			JSON.stringify({ error: "Internal processing error" }),
			{ status: 500, headers: { "Content-Type": "application/json" } },
		);
	}
}
