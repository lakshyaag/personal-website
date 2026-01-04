import { supabaseAdmin } from "@/lib/supabase-client";
import { normalizeExerciseName } from "@/lib/exercises";
import type { WorkoutLogDbRow, WorkoutExercise } from "@/lib/models";

export async function GET() {
	try {
		const { data: logs, error } = await supabaseAdmin
			.from("workout_logs")
			.select("log_date, ai_exercises")
			.not("ai_exercises", "is", null)
			.order("log_date", { ascending: false });

		if (error) throw error;

		const exerciseHistory: Record<
			string,
			{
				canonicalName: string;
				lastPerformed: string;
				lastSets: NonNullable<WorkoutExercise["sets"]>;
				lastNotes?: string | null;
				count: number;
			}
		> = {};

		for (const log of logs as unknown as WorkoutLogDbRow[]) {
			const exercises = log.ai_exercises as WorkoutExercise[];
			if (!exercises) continue;

			for (const ex of exercises) {
				const name = normalizeExerciseName(ex.name);

				if (!exerciseHistory[name]) {
					exerciseHistory[name] = {
						canonicalName: name,
						lastPerformed: log.log_date,
						lastSets: ex.sets || [],
						lastNotes: ex.notes,
						count: 1,
					};
				} else {
					exerciseHistory[name].count++;
				}
			}
		}

		return Response.json({ exercises: Object.values(exerciseHistory) });
	} catch (error) {
		console.error("Error fetching exercise history:", error);
		return Response.json(
			{ error: "Failed to fetch exercise history" },
			{ status: 500 },
		);
	}
}
