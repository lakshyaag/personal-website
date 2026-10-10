import { z } from "zod";
import { dateSchema, idSchema } from "./common";
import { photoIdsSchema, photoSchema } from "./photos";

export const foodAnalysisSchema = z.object({
	foodName: z.string(),
	calories: z.number(),
	proteinG: z.number(),
	carbsG: z.number(),
	fatG: z.number(),
	notes: z.string(),
});
export type FoodAnalysis = z.infer<typeof foodAnalysisSchema>;

export const foodEntrySchema = z.object({
	id: idSchema,
	date: dateSchema,
	/** When the meal was eaten; the form's date + time. */
	eatenAt: z.iso.datetime(),
	description: z.string().optional(),
	photos: z.array(photoSchema),
	aiFoodName: z.string().optional(),
	aiCalories: z.number().optional(),
	aiProteinG: z.number().optional(),
	aiCarbsG: z.number().optional(),
	aiFatG: z.number().optional(),
	aiNotes: z.string().optional(),
	/** An analysis job is queued; the result replaces the ai* fields when it lands. */
	analysisPending: z.boolean(),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
});
export type FoodEntry = z.infer<typeof foodEntrySchema>;
export const foodListSchema = z.object({ entries: z.array(foodEntrySchema) });

export const saveFoodSchema = z
	.object({
		date: dateSchema,
		eatenAt: z.iso.datetime(),
		description: z.string().trim().max(10_000),
		photoIds: photoIdsSchema,
	})
	.strict()
	.refine(
		(input) => input.description.length > 0 || input.photoIds.length > 0,
		"Add a description or a photo",
	);
export type SaveFoodInput = z.infer<typeof saveFoodSchema>;
