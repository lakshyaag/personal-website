import { z } from "zod";
import { dateSchema } from "../../shared/common";
import {
	type FoodEntry,
	type SaveFoodInput,
	foodAnalysisSchema,
} from "../../shared/food";
import { generateJson, looseNumber } from "./ai";
import {
	ApiError,
	type Env,
	batchOrConflict,
	now,
	optional,
	statement,
} from "./http";
import { linkedPhotos, replaceLinks, signedPhotoUrl } from "./photos";

interface FoodRow {
	id: string;
	entry_date: string;
	eaten_at: string;
	description: string | null;
	ai_food_name: string | null;
	ai_calories: number | null;
	ai_protein_g: number | null;
	ai_carbs_g: number | null;
	ai_fat_g: number | null;
	ai_notes: string | null;
	created_at: string;
	updated_at: string;
}

async function foodDtos(env: Env, rows: FoodRow[]): Promise<FoodEntry[]> {
	const photos = await linkedPhotos(
		env,
		"food",
		rows.map((row) => row.id),
	);
	return rows.map((row) => ({
		id: row.id,
		date: row.entry_date,
		eatenAt: row.eaten_at,
		description: optional(row.description),
		photos: photos.get(row.id) ?? [],
		aiFoodName: optional(row.ai_food_name),
		aiCalories: optional(row.ai_calories),
		aiProteinG: optional(row.ai_protein_g),
		aiCarbsG: optional(row.ai_carbs_g),
		aiFatG: optional(row.ai_fat_g),
		aiNotes: optional(row.ai_notes),
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}));
}
async function foodRow(env: Env, id: string) {
	return statement(
		env,
		"SELECT * FROM food_entries WHERE id = ?",
		id,
	).first<FoodRow>();
}
export async function getFood(env: Env, id: string) {
	const row = await foodRow(env, id);
	if (!row) throw new ApiError(404, "NOT_FOUND", "Food entry not found");
	return (await foodDtos(env, [row]))[0];
}
export async function listFood(env: Env, url: URL) {
	const date = url.searchParams.get("date");
	const { results } = date
		? await statement(
				env,
				"SELECT * FROM food_entries WHERE entry_date = ? ORDER BY eaten_at DESC, id",
				dateSchema.parse(date),
			).all<FoodRow>()
		: await statement(
				env,
				"SELECT * FROM food_entries ORDER BY entry_date DESC, eaten_at DESC, id",
			).all<FoodRow>();
	return { entries: await foodDtos(env, results) };
}

/** Saving keeps the AI analysis unless the description or photos changed. */
export async function saveFood(env: Env, id: string, input: SaveFoodInput) {
	const previous = await foodRow(env, id);
	const previousPhotos = previous
		? ((await linkedPhotos(env, "food", [id])).get(id) ?? []).map((p) => p.id)
		: [];
	const inputChanged =
		!previous ||
		(previous.description ?? "") !== input.description ||
		previousPhotos.join() !== input.photoIds.join();
	const timestamp = now();
	await batchOrConflict(
		env,
		[
			statement(
				env,
				`INSERT INTO food_entries (id,entry_date,eaten_at,description,created_at,updated_at) VALUES (?,?,?,?,?,?)
				ON CONFLICT(id) DO UPDATE SET entry_date=excluded.entry_date,eaten_at=excluded.eaten_at,
				description=excluded.description,updated_at=excluded.updated_at`,
				id,
				input.date,
				input.eatenAt,
				input.description || null,
				timestamp,
				timestamp,
			),
			...(inputChanged && previous
				? [
						statement(
							env,
							`UPDATE food_entries SET ai_food_name=NULL,ai_calories=NULL,ai_protein_g=NULL,
							ai_carbs_g=NULL,ai_fat_g=NULL,ai_notes=NULL WHERE id = ?`,
							id,
						),
					]
				: []),
			...(await replaceLinks(env, "food", id, input.photoIds)),
		],
		"Photos are not ready. Wait for uploads and retry.",
	);
	return getFood(env, id);
}
export async function deleteFood(env: Env, id: string) {
	if (!(await foodRow(env, id)))
		throw new ApiError(404, "NOT_FOUND", "Food entry not found");
	await batchOrConflict(
		env,
		[
			statement(env, "DELETE FROM food_entries WHERE id = ?", id),
			...(await replaceLinks(env, "food", id, [])),
		],
		"Entry changed. Reload and retry.",
	);
}

const foodModelSchema = z.object({
	foodName: z
		.string()
		.describe("A concise name for the food item(s) identified"),
	calories: z.number().describe("Estimated total calories (kcal)"),
	proteinG: z.number().describe("Estimated protein content in grams"),
	carbsG: z.number().describe("Estimated carbohydrate content in grams"),
	fatG: z.number().describe("Estimated fat content in grams"),
	notes: z
		.string()
		.describe(
			"Brief nutritional notes, highlights, or health tips about this food",
		),
});

export async function analyzeFood(env: Env, id: string, origin: string) {
	const entry = await getFood(env, id);
	if (!entry.description && !entry.photos.length)
		throw new ApiError(400, "EMPTY", "This entry has nothing to analyze");
	const raw = (await generateJson(env, {
		name: "food_analysis",
		schema: foodModelSchema,
		text: `Analyze this food entry and provide nutritional information.

Food description: ${entry.description || "See the attached image(s)"}

Provide your best estimate for the nutritional content. If you're uncertain, provide reasonable estimates based on typical serving sizes. The notes should include any health considerations or tips.`,
		imageUrls: await Promise.all(
			entry.photos.map((photo) => signedPhotoUrl(env, origin, photo)),
		),
	})) as Record<string, unknown>;
	const result = foodAnalysisSchema.parse({
		foodName: String(raw.foodName ?? ""),
		calories: looseNumber(raw.calories) ?? 0,
		proteinG: looseNumber(raw.proteinG) ?? 0,
		carbsG: looseNumber(raw.carbsG) ?? 0,
		fatG: looseNumber(raw.fatG) ?? 0,
		notes: String(raw.notes ?? ""),
	});
	// Only apply the analysis to the version it was made from.
	const updated = await statement(
		env,
		`UPDATE food_entries SET ai_food_name=?,ai_calories=?,ai_protein_g=?,ai_carbs_g=?,ai_fat_g=?,ai_notes=?
		WHERE id = ? AND updated_at = ?`,
		result.foodName,
		result.calories,
		result.proteinG,
		result.carbsG,
		result.fatG,
		result.notes,
		id,
		entry.updatedAt,
	).run();
	if (!updated.meta.changes)
		throw new ApiError(
			409,
			"CONFLICT",
			"Entry changed during analysis. Retry.",
		);
	return getFood(env, id);
}
