import "server-only";
import { normalizeExerciseName } from "@/lib/exercises";
import type { WorkoutExercise, WorkoutLog } from "@/shared/workouts";

function weekStart(dateStr: string) {
	const [year, month, day] = dateStr.split("-").map(Number);
	const date = new Date(year, month - 1, day);
	const dayOfWeek = date.getDay();
	date.setDate(date.getDate() + (dayOfWeek === 0 ? -6 : 1 - dayOfWeek));
	return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Last three months of volume and sets per muscle group, by day and by week. */
export function workoutStats(logs: WorkoutLog[], now = new Date()) {
	const since = new Date(now);
	since.setMonth(since.getMonth() - 3);
	const cutoff = since.toISOString().slice(0, 10);
	const recent = logs
		.filter((log) => log.date >= cutoff)
		.sort((a, b) => a.date.localeCompare(b.date));
	const dailyStats: Record<string, { volume: number; count: number }> = {};
	const dailyMuscles: Record<string, Record<string, number>> = {};
	const weeklyVolume: Record<string, number> = {};
	const weeklyMuscles: Record<string, Record<string, number>> = {};
	for (const log of recent) {
		const volume = log.aiTotalVolume ?? 0;
		const week = weekStart(log.date);
		dailyStats[log.date] ??= { volume: 0, count: 0 };
		dailyStats[log.date].volume += volume;
		dailyStats[log.date].count += 1;
		weeklyVolume[week] = (weeklyVolume[week] ?? 0) + volume;
		dailyMuscles[log.date] ??= {};
		weeklyMuscles[week] ??= {};
		for (const exercise of log.aiExercises ?? []) {
			const sets = exercise.sets?.length ?? 1;
			for (const muscle of exercise.muscleGroups) {
				const name = muscle.toLowerCase();
				dailyMuscles[log.date][name] =
					(dailyMuscles[log.date][name] ?? 0) + sets;
				weeklyMuscles[week][name] = (weeklyMuscles[week][name] ?? 0) + sets;
			}
		}
	}
	const weeks = Object.keys(weeklyVolume).sort();
	const days = Object.keys(dailyStats).sort();
	return {
		dailyStats,
		dailyVolume: days.map((date) => ({
			date,
			volume: dailyStats[date].volume,
		})),
		weeklyVolume: weeks.map((week) => ({ week, volume: weeklyVolume[week] })),
		muscleGroupsByDay: days.map((date) => ({
			date,
			muscles: dailyMuscles[date],
		})),
		muscleGroupsByWeek: weeks.map((week) => ({
			week,
			muscles: weeklyMuscles[week],
		})),
		allMuscleGroups: Array.from(
			new Set(Object.values(weeklyMuscles).flatMap(Object.keys)),
		).sort(),
	};
}

const newestFirst = (logs: WorkoutLog[]) =>
	[...logs].sort((a, b) => b.date.localeCompare(a.date));
/** Every analyzed exercise with its most recent sets. */
export function exerciseSummaries(logs: WorkoutLog[]) {
	const byName = new Map<
		string,
		{
			canonicalName: string;
			lastPerformed: string;
			lastSets: NonNullable<WorkoutExercise["sets"]>;
			lastNotes?: string | null;
			count: number;
		}
	>();
	for (const log of newestFirst(logs))
		for (const exercise of log.aiExercises ?? []) {
			const name = normalizeExerciseName(exercise.name);
			const existing = byName.get(name);
			if (existing) existing.count++;
			else
				byName.set(name, {
					canonicalName: name,
					lastPerformed: log.date,
					lastSets: exercise.sets ?? [],
					lastNotes: exercise.notes,
					count: 1,
				});
		}
	return { exercises: [...byName.values()] };
}
export function exerciseHistory(logs: WorkoutLog[], name: string) {
	const target = normalizeExerciseName(name);
	return {
		exercise: target,
		history: newestFirst(logs).flatMap((log) =>
			(log.aiExercises ?? [])
				.filter((exercise) => normalizeExerciseName(exercise.name) === target)
				.map((exercise) => ({
					date: log.date,
					sets: exercise.sets ?? [],
					notes: exercise.notes,
					category: exercise.category,
					muscleGroups: exercise.muscleGroups,
				})),
		),
	};
}
