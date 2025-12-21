import type { WorkoutLogDbRow } from "@/lib/models";
import { supabaseAdmin } from "@/lib/supabase-client";

export async function GET() {
	const threeMonthsAgo = new Date();
	threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

	const { data, error } = await supabaseAdmin
		.from("workout_logs")
		.select("*")
		.gte("log_date", threeMonthsAgo.toISOString().split("T")[0])
		.order("log_date", { ascending: true });

	if (error) {
		return Response.json({ error: error.message }, { status: 500 });
	}

	const logs = data as WorkoutLogDbRow[];

	const dailyStats: Record<string, { volume: number; count: number }> = {};
	const dailyMuscleGroups: Record<string, Record<string, number>> = {};
	const weeklyVolume: Record<string, number> = {};
	const weeklyMuscleGroups: Record<string, Record<string, number>> = {};

	for (const log of logs) {
		const date = log.log_date;
		const volume = log.ai_total_volume ?? 0;

		if (!dailyStats[date]) {
			dailyStats[date] = { volume: 0, count: 0 };
		}
		dailyStats[date].volume += volume;
		dailyStats[date].count += 1;

		const weekStart = getWeekStart(date);
		weeklyVolume[weekStart] = (weeklyVolume[weekStart] ?? 0) + volume;

		if (!dailyMuscleGroups[date]) {
			dailyMuscleGroups[date] = {};
		}
		if (!weeklyMuscleGroups[weekStart]) {
			weeklyMuscleGroups[weekStart] = {};
		}

		const exercises = log.ai_exercises as Array<{
			muscleGroups?: string[];
			sets?: unknown[];
		}> | null;
		if (exercises) {
			for (const exercise of exercises) {
				const setCount = exercise.sets?.length ?? 1;
				for (const muscle of exercise.muscleGroups ?? []) {
					const normalizedMuscle = muscle.toLowerCase();
					dailyMuscleGroups[date][normalizedMuscle] =
						(dailyMuscleGroups[date][normalizedMuscle] ?? 0) + setCount;
					weeklyMuscleGroups[weekStart][normalizedMuscle] =
						(weeklyMuscleGroups[weekStart][normalizedMuscle] ?? 0) + setCount;
				}
			}
		}
	}

	const sortedWeeks = Object.keys(weeklyVolume).sort();
	const weeklyVolumeArray = sortedWeeks.map((week) => ({
		week,
		volume: weeklyVolume[week],
	}));

	const sortedDays = Object.keys(dailyStats).sort();
	const dailyVolumeArray = sortedDays.map((day) => ({
		date: day,
		volume: dailyStats[day].volume,
	}));

	const muscleGroupsByWeek = sortedWeeks.map((week) => ({
		week,
		muscles: weeklyMuscleGroups[week] ?? {},
	}));

	const muscleGroupsByDay = sortedDays.map((day) => ({
		date: day,
		muscles: dailyMuscleGroups[day] ?? {},
	}));

	const allMuscles = new Set<string>();
	for (const week of Object.values(weeklyMuscleGroups)) {
		for (const muscle of Object.keys(week)) {
			allMuscles.add(muscle);
		}
	}

	return Response.json({
		dailyStats,
		dailyVolume: dailyVolumeArray,
		weeklyVolume: weeklyVolumeArray,
		muscleGroupsByDay,
		muscleGroupsByWeek,
		allMuscleGroups: Array.from(allMuscles).sort(),
	});
}

function getWeekStart(dateStr: string): string {
	const [year, month, day] = dateStr.split("-").map(Number);
	const date = new Date(year, month - 1, day);
	const dayOfWeek = date.getDay();
	const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
	date.setDate(date.getDate() + diffToMonday);
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}
