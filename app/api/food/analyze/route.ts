import { generateObject } from "ai";
import { z } from "zod";
import { primeIntellect } from "@/lib/ai";
import { saveAIMetadata } from "@/lib/ai-metadata-db";
import { supabaseAdmin } from "@/lib/supabase-client";

export const maxDuration = 60;

// Schema for structured AI response
const foodAnalysisSchema = z.object({
    foodName: z
        .string()
        .describe("A concise name for the food item(s) identified"),
    calories: z.number().int().describe("Estimated total calories (kcal)"),
    proteinG: z.number().describe("Estimated protein content in grams"),
    carbsG: z.number().describe("Estimated carbohydrate content in grams"),
    fatG: z.number().describe("Estimated fat content in grams"),
    notes: z
        .string()
        .describe(
            "Brief nutritional notes, highlights, or health tips about this food",
        ),
});

export type FoodAnalysisResult = z.infer<typeof foodAnalysisSchema>;

interface AnalyzeRequest {
    entryId: string;
    description?: string;
    photos?: string[];
}

const MODEL_NAME = "openai/gpt-5-mini";
const PROVIDER_NAME = "prime-intellect";

export async function POST(req: Request) {
    const { entryId, description, photos }: AnalyzeRequest = await req.json();

    if (!entryId) {
        return new Response(JSON.stringify({ error: "Entry ID is required" }), {
            status: 400,
            headers: { "Content-Type": "application/json" },
        });
    }

    if (!description && (!photos || photos.length === 0)) {
        return new Response(
            JSON.stringify({ error: "No description or photos provided" }),
            { status: 400, headers: { "Content-Type": "application/json" } },
        );
    }

    // Build multimodal content parts
    const contentParts: Array<
        { type: "text"; text: string } | { type: "image"; image: string }
    > = [];

    // Add the analysis prompt
    const prompt = `Analyze this food entry and provide nutritional information.

Food description: ${description || "See the attached image(s)"}

Provide your best estimate for the nutritional content. If you're uncertain, provide reasonable estimates based on typical serving sizes. The notes should include any health considerations or tips.`;

    contentParts.push({ type: "text", text: prompt });

    // Add images if provided
    if (photos && photos.length > 0) {
        for (const photoUrl of photos) {
            contentParts.push({ type: "image", image: photoUrl });
        }
    }

    const inputMessages = [
        {
            role: "user" as const,
            content: contentParts,
        },
    ];

    try {
        const result = await generateObject({
            model: primeIntellect(MODEL_NAME),
            schema: foodAnalysisSchema,
            messages: inputMessages,
        });


        // Save AI metadata to database
        const metadataId = await saveAIMetadata({
            provider: PROVIDER_NAME,
            model: MODEL_NAME,
            inputMessages: inputMessages,
            result: result,
        });

        console.log("Result Reasoning:", result.reasoning);
        console.log("Result Response:", result.response);

        const analysisData = result.object;

        // Update the food entry with AI analysis results
        const { error: updateError } = await supabaseAdmin
            .from("food_entries")
            .update({
                ai_food_name: analysisData.foodName,
                ai_calories: analysisData.calories,
                ai_protein_g: analysisData.proteinG,
                ai_carbs_g: analysisData.carbsG,
                ai_fat_g: analysisData.fatG,
                ai_notes: analysisData.notes,
                ai_metadata_id: metadataId,
                updated_at: new Date().toISOString(),
            })
            .eq("id", entryId);

        if (updateError) {
            console.error("Error updating food entry with AI analysis:", updateError);
            // Don't fail the request, just log the error - the analysis was successful
        }

        // Return the structured result with metadata ID
        return Response.json({
            ...analysisData,
            metadataId,
        });
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
