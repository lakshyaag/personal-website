import { z } from "zod";
import { dateSchema, idSchema } from "./common";
import { photoIdsSchema, photoSchema } from "./photos";

export const exerciseSchema = z.object({
	name: z.string(),
	category: z.enum(["compound", "isolation", "cardio", "core", "other"]),
	muscleGroups: z.array(z.string()),
	sets: z
		.array(
			z.object({ weight: z.number().nullable(), reps: z.number().nullable() }),
		)
		.optional(),
	duration: z.string().nullable().optional(),
	incline: z.number().nullable().optional(),
	speed: z.number().nullable().optional(),
	notes: z.string().nullable().optional(),
});
export type WorkoutExercise = z.infer<typeof exerciseSchema>;
export const sessionTypes = ["strength", "cardio", "mixed", "other"] as const;
export const workoutAnalysisSchema = z.object({
	sessionType: z.enum(sessionTypes),
	exercises: z.array(exerciseSchema),
	totalVolume: z.number().nullable(),
	muscleGroups: z.array(z.string()),
	notes: z.string().nullable(),
});
export type WorkoutAnalysis = z.infer<typeof workoutAnalysisSchema>;

export const workoutLogSchema = z.object({
	id: idSchema,
	date: dateSchema,
	content: z.string().optional(),
	/** Body weight that day. */
	weight: z.number().optional(),
	photos: z.array(photoSchema),
	aiSessionType: z.enum(sessionTypes).optional(),
	aiExercises: z.array(exerciseSchema).optional(),
	aiTotalVolume: z.number().optional(),
	aiMuscleGroups: z.array(z.string()).optional(),
	aiNotes: z.string().optional(),
	/** An analysis job is queued; the result replaces the ai* fields when it lands. */
	analysisPending: z.boolean(),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
});
export type WorkoutLog = z.infer<typeof workoutLogSchema>;
export const workoutListSchema = z.object({ logs: z.array(workoutLogSchema) });

export const saveWorkoutSchema = z
	.object({
		date: dateSchema,
		content: z.string().trim().max(20_000),
		weight: z.number().positive().max(1000).nullable(),
		photoIds: photoIdsSchema,
	})
	.strict()
	.refine(
		(input) =>
			input.content.length > 0 ||
			input.weight !== null ||
			input.photoIds.length > 0,
		"Add a workout, weight or photo",
	);
export type SaveWorkoutInput = z.infer<typeof saveWorkoutSchema>;
