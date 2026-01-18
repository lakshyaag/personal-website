import { generateObject } from "ai";
import { z } from "zod";
import { primeIntellect } from "@/lib/ai";
import { saveAIMetadata } from "@/lib/ai-metadata-db";
import { getAIConfig } from "@/lib/ai-config-db";
import { supabaseAdmin } from "@/lib/supabase-client";
import { parseSupabaseRef, isHttpUrl, isSupabaseRef } from "@/lib/photo-refs";

// Flexible number schema for nutritional values
// Handles cases where AI returns "500", "500 kcal", "25g", or numbers
const flexibleNutritionNumber = z
    .union([z.number(), z.string(), z.null()])
    .transform((val) => {
        if (val === null || val === undefined) return 0;
        if (typeof val === "number") return val;
        // Extract number from strings like "500 kcal", "25g", "100 calories"
        const match = val.match(/(\d+\.?\d*)/);
        if (match) {
            return Number.parseFloat(match[1]);
        }
        return 0;
    });

// Schema for structured AI response (shared with the old route for now)
export const foodAnalysisSchema = z.object({
    foodName: z
        .string()
        .describe("A concise name for the food item(s) identified"),
    calories: flexibleNutritionNumber.describe("Estimated total calories (kcal)"),
    proteinG: flexibleNutritionNumber.describe("Estimated protein content in grams"),
    carbsG: flexibleNutritionNumber.describe("Estimated carbohydrate content in grams"),
    fatG: flexibleNutritionNumber.describe("Estimated fat content in grams"),
    notes: z
        .string()
        .describe(
            "Brief nutritional notes, highlights, or health tips about this food",
        ),
});

export type FoodAnalysisResult = z.infer<typeof foodAnalysisSchema>;

/**
 * Server-side version of resolvePhotoUrl that uses supabaseAdmin
 */
async function resolvePhotoUrlServer(ref: string): Promise<string> {
    if (isHttpUrl(ref)) return ref;

    if (isSupabaseRef(ref)) {
        const parsed = parseSupabaseRef(ref);
        if (parsed) {
            const { data, error } = await supabaseAdmin.storage
                .from(parsed.bucket)
                .createSignedUrl(parsed.path, 3600); // 1 hour

            if (error) {
                console.error("Failed to create signed URL server-side:", error);
                return ref;
            }
            return data.signedUrl;
        }
    }

    return ref;
}

/**
 * Analyzes a food entry using AI and updates the database with the results.
 * This is the centralized logic used by both the manual trigger and the automatic webhook.
 */
export async function analyzeFoodEntry(entryId: string) {
    console.log(`[AI Analysis] Starting analysis for entry: ${entryId}`);

    // 1. Fetch the food entry
    const { data: entry, error: fetchError } = await supabaseAdmin
        .from("food_entries")
        .select("*")
        .eq("id", entryId)
        .single();

    if (fetchError || !entry) {
        console.error(`[AI Analysis] Error fetching food entry ${entryId}:`, fetchError);
        return null;
    }

    // 2. Check if there's anything to analyze
    if (!entry.description && (!entry.photos || entry.photos.length === 0)) {
        console.log(`[AI Analysis] Entry ${entryId} has no content to analyze.`);
        return null;
    }

    // 3. Prepare multimodal content
    const resolvedPhotos = entry.photos
        ? await Promise.all(entry.photos.map(resolvePhotoUrlServer))
        : [];

    const contentParts: Array<
        { type: "text"; text: string } | { type: "image"; image: string }
    > = [];

    const prompt = `Analyze this food entry and provide nutritional information.

Food description: ${entry.description || "See the attached image(s)"}

Provide your best estimate for the nutritional content. If you're uncertain, provide reasonable estimates based on typical serving sizes. The notes should include any health considerations or tips.`;

    contentParts.push({ type: "text", text: prompt });

    if (resolvedPhotos.length > 0) {
        for (const photoUrl of resolvedPhotos) {
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
        // 4. Call AI
        const aiConfig = await getAIConfig();
        const result = await generateObject({
            model: primeIntellect(aiConfig.modelName),
            schema: foodAnalysisSchema,
            messages: inputMessages,
            providerOptions: {
                extra_body: {
                    usage: { include: true },
                },
            },
        });

        // 5. Save metadata
        const metadataId = await saveAIMetadata({
            provider: aiConfig.providerName,
            model: aiConfig.modelName,
            inputMessages: inputMessages,
            result: result,
        });

        const analysisData = result.object;

        // 6. Update entry
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
            console.error(`[AI Analysis] Error updating food entry ${entryId}:`, updateError);
        } else {
            console.log(`[AI Analysis] Successfully analyzed and updated entry: ${entryId}`);
        }

        return {
            ...analysisData,
            metadataId,
        };
    } catch (error) {
        console.error(`[AI Analysis] AI analysis error for entry ${entryId}:`, error);
        throw error;
    }
}

