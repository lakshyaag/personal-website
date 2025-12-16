import { streamText } from "ai";
import { primeIntellect } from "@/lib/ai";

export const maxDuration = 60;

interface AnalyzeRequest {
    description?: string;
    photos?: string[];
}

export async function POST(req: Request) {
    const { description, photos }: AnalyzeRequest = await req.json();

    if (!description && (!photos || photos.length === 0)) {
        return new Response(
            JSON.stringify({ error: "No description or photos provided" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
        );
    }

    // Build multimodal content parts
    const contentParts: Array<
        | { type: "text"; text: string }
        | { type: "image"; image: string }
    > = [];

    // Add the analysis prompt
    const prompt = `You are a nutritionist assistant. Analyze the following food entry and provide:
1. A brief description of what the food appears to be
2. Estimated calories (provide a range if uncertain)
3. Estimated macronutrients (protein, carbs, fats in grams)
4. Any notable nutritional highlights or concerns
5. A brief health tip related to this food

Be concise but informative. Format your response in a clear, readable way.

Food description: ${description || "See the attached image(s)"}`;

    contentParts.push({ type: "text", text: prompt });

    // Add images if provided
    if (photos && photos.length > 0) {
        for (const photoUrl of photos) {
            contentParts.push({ type: "image", image: photoUrl });
        }
    }

    const result = streamText({
        model: primeIntellect("google/gemini-3-pro-preview"),
        messages: [
            {
                role: "user",
                content: contentParts,
            },
        ],
    });

    return result.toTextStreamResponse();
}

