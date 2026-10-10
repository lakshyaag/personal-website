import { z } from "zod";
import exercises from "../../data/exercises.json";
import { dateSchema } from "../../shared/common";
import {
	type SaveWorkoutInput,
	type WorkoutExercise,
	type WorkoutLog,
	sessionTypes,
	workoutAnalysisSchema,
} from "../../shared/workouts";
import { generateJson, looseNumber } from "./ai";
import {
	ApiError,
	type Env,
	batchOrConflict,
	jsonColumn,
	now,
	optional,
	statement,
} from "./http";
import { linkedPhotos, replaceLinks } from "./photos";

interface WorkoutRow {
	id: string;
	log_date: string;
	content: string | null;
	weight: number | null;
	ai_session_type: WorkoutLog["aiSessionType"] | null;
	ai_exercises: string | null;
	ai_total_volume: number | null;
	ai_muscle_groups: string | null;
	ai_notes: string | null;
	created_at: string;
	updated_at: string;
}

async function workoutDtos(
	env: Env,
	rows: WorkoutRow[],
): Promise<WorkoutLog[]> {
	const photos = await linkedPhotos(
		env,
		"workout",
		rows.map((row) => row.id),
	);
	return rows.map((row) => ({
		id: row.id,
		date: row.log_date,
		content: optional(row.content),
		weight: optional(row.weight),
		photos: photos.get(row.id) ?? [],
		aiSessionType: optional(row.ai_session_type),
		aiExercises: row.ai_exercises
			? jsonColumn<WorkoutExercise[]>(row.ai_exercises, [])
			: undefined,
		aiTotalVolume: optional(row.ai_total_volume),
		aiMuscleGroups: row.ai_muscle_groups
			? jsonColumn<string[]>(row.ai_muscle_groups, [])
			: undefined,
		aiNotes: optional(row.ai_notes),
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}));
}
async function workoutRow(env: Env, id: string) {
	return statement(
		env,
		"SELECT * FROM workout_logs WHERE id = ?",
		id,
	).first<WorkoutRow>();
}
export async function getWorkout(env: Env, id: string) {
	const row = await workoutRow(env, id);
	if (!row) throw new ApiError(404, "NOT_FOUND", "Workout not found");
	return (await workoutDtos(env, [row]))[0];
}
export async function listWorkouts(env: Env, url: URL) {
	const date = url.searchParams.get("date");
	const { results } = date
		? await statement(
				env,
				"SELECT * FROM workout_logs WHERE log_date = ? ORDER BY created_at DESC, id",
				dateSchema.parse(date),
			).all<WorkoutRow>()
		: await statement(
				env,
				"SELECT * FROM workout_logs ORDER BY log_date DESC, created_at DESC, id",
			).all<WorkoutRow>();
	return { logs: await workoutDtos(env, results) };
}

/** Saving keeps the AI analysis unless the workout text changed. */
export async function saveWorkout(
	env: Env,
	id: string,
	input: SaveWorkoutInput,
) {
	const previous = await workoutRow(env, id);
	const timestamp = now();
	await batchOrConflict(
		env,
		[
			statement(
				env,
				`INSERT INTO workout_logs (id,log_date,content,weight,created_at,updated_at) VALUES (?,?,?,?,?,?)
				ON CONFLICT(id) DO UPDATE SET log_date=excluded.log_date,content=excluded.content,
				weight=excluded.weight,updated_at=excluded.updated_at`,
				id,
				input.date,
				input.content || null,
				input.weight,
				timestamp,
				timestamp,
			),
			...(previous && (previous.content ?? "") !== input.content
				? [
						statement(
							env,
							`UPDATE workout_logs SET ai_session_type=NULL,ai_exercises=NULL,ai_total_volume=NULL,
							ai_muscle_groups=NULL,ai_notes=NULL WHERE id = ?`,
							id,
						),
					]
				: []),
			...(await replaceLinks(env, "workout", id, input.photoIds)),
		],
		"Photos are not ready. Wait for uploads and retry.",
	);
	return getWorkout(env, id);
}
export async function deleteWorkout(env: Env, id: string) {
	if (!(await workoutRow(env, id)))
		throw new ApiError(404, "NOT_FOUND", "Workout not found");
	await batchOrConflict(
		env,
		[
			statement(env, "DELETE FROM workout_logs WHERE id = ?", id),
			...(await replaceLinks(env, "workout", id, [])),
		],
		"Workout changed. Reload and retry.",
	);
}

const nullableNumber = z.number().nullable();
const workoutModelSchema = z.object({
	sessionType: z.enum(sessionTypes).describe("Overall workout session type"),
	exercises: z
		.array(
			z.object({
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
					.array(
						z.object({
							weight: nullableNumber.describe(
								"Weight in lbs, null for bodyweight or cardio",
							),
							reps: nullableNumber.describe(
								"Number of reps, null for cardio/timed exercises",
							),
						}),
					)
					.optional()
					.describe("Array of sets with weight/reps for strength exercises"),
				duration: z
					.string()
					.nullable()
					.optional()
					.describe("Total duration for cardio or timed exercises"),
				incline: nullableNumber
					.optional()
					.describe("Incline setting for treadmill (e.g., 12 for '12 at 3')"),
				speed: nullableNumber
					.optional()
					.describe("Speed setting for treadmill (e.g., 3 for '12 at 3')"),
				notes: z
					.string()
					.nullable()
					.optional()
					.describe(
						"Any notes about this specific exercise or how the user should feel after this workout",
					),
			}),
		)
		.describe("List of exercises performed"),
	muscleGroups: z
		.array(z.string())
		.describe("Aggregated list of all muscle groups worked in this session"),
	notes: z
		.string()
		.nullable()
		.describe("General workout observations or notes from the entry"),
});

const strings = (value: unknown) =>
	Array.isArray(value) ? value.map(String) : [];
const weight = (value: unknown) =>
	typeof value === "string" && /bodyweight|^bw$/i.test(value.trim())
		? null
		: looseNumber(value);
/** Coerces the model's loosely typed answer into the stored shape. */
function normalizeWorkout(raw: Record<string, unknown>) {
	const exerciseList = (Array.isArray(raw.exercises) ? raw.exercises : []).map(
		(item: Record<string, unknown>) => ({
			name: String(item.name ?? "Unknown"),
			category: (["compound", "isolation", "cardio", "core"].includes(
				String(item.category),
			)
				? item.category
				: "other") as WorkoutExercise["category"],
			muscleGroups: strings(item.muscleGroups),
			sets: Array.isArray(item.sets)
				? item.sets.map((set: Record<string, unknown>) => ({
						weight: weight(set?.weight),
						reps: looseNumber(set?.reps),
					}))
				: undefined,
			duration:
				item.duration === null || item.duration === undefined
					? null
					: String(item.duration),
			incline: looseNumber(item.incline),
			speed: looseNumber(item.speed),
			notes: typeof item.notes === "string" ? item.notes : null,
		}),
	);
	let volume = 0;
	for (const exercise of exerciseList)
		for (const set of exercise.sets ?? [])
			if (set.weight && set.reps) volume += set.weight * set.reps;
	return workoutAnalysisSchema.parse({
		sessionType: sessionTypes.includes(raw.sessionType as never)
			? raw.sessionType
			: "other",
		exercises: exerciseList,
		totalVolume: volume > 0 ? volume : null,
		muscleGroups: strings(raw.muscleGroups),
		notes: typeof raw.notes === "string" ? raw.notes : null,
	});
}

export async function analyzeWorkout(env: Env, id: string) {
	const log = await getWorkout(env, id);
	if (!log.content)
		throw new ApiError(400, "EMPTY", "This workout has no text to analyze");
	const canonicalNames = exercises.map((ex) => ex.canonicalName).join(", ");
	const result = normalizeWorkout(
		(await generateJson(env, {
			name: "workout_analysis",
			schema: workoutModelSchema,
			text: `Analyze this workout log entry and extract structured exercise data.

Instructions:
1. Parse each exercise mentioned, including the exercise name, weights used, sets, and reps.
2. For entries like "25,35,35 - 8-10 reps", interpret as 3 sets with weights 25, 35, 35 lbs and 8-10 reps each.
3. For rep ranges like "8-10 reps", use the average (9) as the rep count. Keep reps as integer.
4. For cardio like "Incline walk - 12 at 3 for 25 mins", extract incline=12, speed=3, duration=25.
5. Identify the primary muscle groups for each exercise.
6. Determine if this is a strength, cardio, or mixed session.
7. IMPORTANT: Use these canonical names for exercises if they match: ${canonicalNames}. If an exercise doesn't match any of these, use a consistent Title Case name.

Workout description:
${log.content}`,
		})) as Record<string, unknown>,
	);
	const updated = await statement(
		env,
		`UPDATE workout_logs SET ai_session_type=?,ai_exercises=?,ai_total_volume=?,ai_muscle_groups=?,ai_notes=?
		WHERE id = ? AND updated_at = ?`,
		result.sessionType,
		JSON.stringify(result.exercises),
		result.totalVolume,
		JSON.stringify(result.muscleGroups),
		result.notes,
		id,
		log.updatedAt,
	).run();
	if (!updated.meta.changes)
		throw new ApiError(
			409,
			"CONFLICT",
			"Workout changed during analysis. Retry.",
		);
	return getWorkout(env, id);
}
