import { analyzeFoodEntry } from "@/lib/food-analysis-server";

export const maxDuration = 120;

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
        const result = await analyzeFoodEntry(entryId);

        if (!result) {
            return new Response(
                JSON.stringify({ error: "Entry has no content to analyze or could not be found" }),
                { status: 400, headers: { "Content-Type": "application/json" } },
            );
        }

        // Return the structured result with metadata ID
        return Response.json(result);
    } catch (error) {
        console.error("AI analysis error:", error);
        return new Response(
            JSON.stringify({
                error: "Failed to analyze food entry",
                details: error instanceof Error ? error.message : "Unknown error",
            }),
            { status: 500, headers: { "Content-Type": "application/json" } },
        );
    }
}
