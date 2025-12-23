import { analyzeWorkoutEntry } from "@/lib/workout-analysis-server";

export const maxDuration = 60;

interface AnalyzeRequest {
	entryId: string;
}

export async function POST(req: Request) {
	const { entryId }: AnalyzeRequest = await req.json();

	if (!entryId) {
		return new Response(JSON.stringify({ error: "Entry ID is required" }), {
			status: 400,
			headers: { "Content-Type": "application/json" },
		});
	}

	try {
		const result = await analyzeWorkoutEntry(entryId);

		if (!result) {
			return new Response(
				JSON.stringify({
					error: "Entry has no content to analyze or could not be found",
				}),
				{ status: 400, headers: { "Content-Type": "application/json" } },
			);
		}

		return Response.json(result);
	} catch (error) {
		console.error("Workout AI analysis error:", error);
		return new Response(
			JSON.stringify({
				error: "Failed to analyze workout entry",
				details: error instanceof Error ? error.message : "Unknown error",
			}),
			{ status: 500, headers: { "Content-Type": "application/json" } },
		);
	}
}
