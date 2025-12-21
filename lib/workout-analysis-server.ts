import { primeIntellect } from "@/lib/ai";
import { getAIConfig } from "@/lib/ai-config-db";
import { saveAIMetadata } from "@/lib/ai-metadata-db";
import { supabaseAdmin } from "@/lib/supabase-client";
import { generateObject } from "ai";
import { z } from "zod";

const exerciseSetSchema = z.object({
    weight: z
        .number()
        .nullable()
        .describe("Weight in lbs, null for bodyweight or cardio"),
    reps: z
        .number()
        .nullable()
        .describe("Number of reps, null for cardio/timed exercises"),
});

const exerciseSchema = z.object({
    name: z
        .string()
        .describe(
            "Normalized exercise name in title case (e.g., 'Goblet Squat', 'Lat Pulldown', 'Incline Walk')",
        ),
    category: z
        .enum(["compound", "isolation", "cardio", "core", "other"])
        .describe("Exercise category"),
    muscleGroups: z
        .array(z.string())
        .describe(
            "Primary muscle groups worked (e.g., ['quads', 'glutes'], ['lats', 'biceps'])",
        ),
    sets: z
        .array(exerciseSetSchema)
        .optional()
        .describe("Array of sets with weight/reps for strength exercises"),
    duration: z
        .number()
        .nullable()
        .optional()
        .describe("Total duration in minutes for cardio exercises"),
    incline: z
        .number()
        .nullable()
        .optional()
        .describe("Incline setting for treadmill (e.g., 12 for '12 at 3')"),
    speed: z
        .number()
        .nullable()
        .optional()
        .describe("Speed setting for treadmill (e.g., 3 for '12 at 3')"),
    notes: z
        .string()
        .nullable()
        .optional()
        .describe("Any notes about this specific exercise or how the user should feel after this workout"),
});

const workoutAnalysisAISchema = z.object({
    sessionType: z
        .enum(["strength", "cardio", "mixed", "other"])
        .describe("Overall workout session type"),
    exercises: z.array(exerciseSchema).describe("List of exercises performed"),
    muscleGroups: z
        .array(z.string())
        .describe("Aggregated list of all muscle groups worked in this session"),
    notes: z
        .string()
        .nullable()
        .describe("General workout observations or notes from the entry"),
});

export const workoutAnalysisSchema = workoutAnalysisAISchema.extend({
    totalVolume: z
        .number()
        .nullable()
        .describe(
            "Total volume (sum of sets × reps × weight for all exercises)",
        ),
});

export type WorkoutAnalysisResult = z.infer<typeof workoutAnalysisSchema>;

export async function analyzeWorkoutEntry(entryId: string) {
    console.log(`[Workout AI Analysis] Starting analysis for entry: ${entryId}`);

    const { data: entry, error: fetchError } = await supabaseAdmin
        .from("workout_logs")
        .select("*")
        .eq("id", entryId)
        .single();

    if (fetchError || !entry) {
        console.error(
            `[Workout AI Analysis] Error fetching workout entry ${entryId}:`,
            fetchError,
        );
        return null;
    }

    if (!entry.content) {
        console.log(
            `[Workout AI Analysis] Entry ${entryId} has no content to analyze.`,
        );
        return null;
    }

    const prompt = `Analyze this workout log entry and extract structured exercise data with notes about how the user should feel after the workout.
    
Instructions:
1. Parse each exercise mentioned, including the exercise name, weights used, sets, and reps.
2. For entries like "25,35,35 - 8-10 reps", interpret as 3 sets with weights 25, 35, 35 lbs and 8-10 reps each.
3. For rep ranges like "8-10 reps", use the average (9) as the rep count. Keep reps as integer.
4. For cardio like "Incline walk - 12 at 3 for 25 mins", extract incline=12, speed=3, duration=25.
5. Identify the primary muscle groups for each exercise.
6. Determine if this is a strength, cardio, or mixed session.
    
Workout description:
${entry.content}
    `;

    const inputMessages = [
        {
            role: "user" as const,
            content: prompt,
        },
    ];

    try {
        const aiConfig = await getAIConfig();
        const result = await generateObject({
            model: primeIntellect(aiConfig.modelName),
            schema: workoutAnalysisAISchema,
            messages: inputMessages,
            providerOptions: {
                extra_body: {
                    usage: { include: true },
                },
            },
        });

        const metadataId = await saveAIMetadata({
            provider: aiConfig.providerName,
            model: aiConfig.modelName,
            inputMessages: inputMessages,
            result: result,
        });

        const analysisData = result.object;

        // Calculate total volume mathematically from exercises
        let totalVolume = 0;
        for (const exercise of analysisData.exercises) {
            if (exercise.sets) {
                for (const set of exercise.sets) {
                    if (set.weight && set.reps) {
                        totalVolume += set.weight * set.reps;
                    }
                }
            }
        }
        const calculatedTotalVolume = totalVolume > 0 ? totalVolume : null;

        const updatedAnalysisData = {
            ...analysisData,
            totalVolume: calculatedTotalVolume,
        };

        const { error: updateError } = await supabaseAdmin
            .from("workout_logs")
            .update({
                ai_session_type: updatedAnalysisData.sessionType,
                ai_exercises: updatedAnalysisData.exercises,
                ai_total_volume: updatedAnalysisData.totalVolume,
                ai_muscle_groups: updatedAnalysisData.muscleGroups,
                ai_notes: updatedAnalysisData.notes,
                ai_metadata_id: metadataId,
                updated_at: new Date().toISOString(),
            })
            .eq("id", entryId);

        if (updateError) {
            console.error(
                `[Workout AI Analysis] Error updating workout entry ${entryId}:`,
                updateError,
            );
        } else {
            console.log(
                `[Workout AI Analysis] Successfully analyzed and updated entry: ${entryId}`,
            );
        }

        return {
            ...updatedAnalysisData,
            metadataId,
        };
    } catch (error) {
        console.error(
            `[Workout AI Analysis] AI analysis error for entry ${entryId}:`,
            error,
        );
        throw error;
    }
}
