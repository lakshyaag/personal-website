import { supabaseAdmin } from "@/lib/supabase-client";
import { normalizeExerciseName } from "@/lib/exercises";
import type { WorkoutLogDbRow, WorkoutExercise } from "@/lib/models";
import type { NextRequest } from "next/server";

export async function GET(
	_req: NextRequest,
	{ params }: { params: Promise<{ name: string }> },
) {
	try {
		const { name: nameParam } = await params;
		const name = decodeURIComponent(nameParam);
		const normalizedTarget = normalizeExerciseName(name);

		const { data: logs, error } = await supabaseAdmin
			.from("workout_logs")
			.select("log_date, ai_exercises")
			.not("ai_exercises", "is", null)
			.order("log_date", { ascending: false });

		if (error) throw error;

		const history = [];

		for (const log of logs as unknown as WorkoutLogDbRow[]) {
			const exercises = log.ai_exercises as WorkoutExercise[];
			if (!exercises) continue;

			for (const ex of exercises) {
				if (normalizeExerciseName(ex.name) === normalizedTarget) {
					history.push({
						date: log.log_date,
						sets: ex.sets || [],
						notes: ex.notes,
						category: ex.category,
						muscleGroups: ex.muscleGroups,
					});
				}
			}
		}

		return Response.json({
			exercise: normalizedTarget,
			history,
		});
	} catch (error) {
		console.error("Error fetching exercise specific history:", error);
		return Response.json(
			{ error: "Failed to fetch exercise history" },
			{ status: 500 },
		);
	}
}
