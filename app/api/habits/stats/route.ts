import { NextResponse } from "next/server";
import { getActiveHabits, getCompletionsInRange } from "@/lib/habits-db";
import { getAutoHabitStatusRange } from "@/lib/habits-auto";
import type { Habit } from "@/lib/models";

interface HabitStats {
	id: string;
	name: string;
	emoji?: string;
	type: "auto" | "manual";
	currentStreak: number;
	longestStreak: number;
	last30Days: number; // completion count
	last7Days: number;
}

interface DailyCompletion {
	date: string;
	completedCount: number;
	totalCount: number;
	percentage: number;
}

function calculateStreaks(
	completedDates: string[],
	today: string,
): { current: number; longest: number } {
	if (completedDates.length === 0) return { current: 0, longest: 0 };

	const sortedDates = [...completedDates].sort();
	let current = 0;
	let longest = 0;
	let tempStreak = 1;

	// Calculate longest streak
	for (let i = 1; i < sortedDates.length; i++) {
		const prev = new Date(sortedDates[i - 1]);
		const curr = new Date(sortedDates[i]);
		const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);

		if (diffDays === 1) {
			tempStreak++;
		} else {
			longest = Math.max(longest, tempStreak);
			tempStreak = 1;
		}
	}
	longest = Math.max(longest, tempStreak);

	// Calculate current streak (from today backwards)
	const todayDate = new Date(today);
	let checkDate = new Date(today);

	while (true) {
		const dateStr = checkDate.toISOString().split("T")[0];
		if (completedDates.includes(dateStr)) {
			current++;
			checkDate.setDate(checkDate.getDate() - 1);
		} else {
			break;
		}
	}

	return { current, longest };
}

export async function GET() {
	try {
		const today = new Date().toISOString().split("T")[0];

		// Date ranges
		const last90Days = new Date();
		last90Days.setDate(last90Days.getDate() - 90);
		const startDate90 = last90Days.toISOString().split("T")[0];

		const last30Days = new Date();
		last30Days.setDate(last30Days.getDate() - 30);
		const startDate30 = last30Days.toISOString().split("T")[0];

		const last7Days = new Date();
		last7Days.setDate(last7Days.getDate() - 7);
		const startDate7 = last7Days.toISOString().split("T")[0];

		// Fetch data
		const [habits, completions] = await Promise.all([
			getActiveHabits(),
			getCompletionsInRange(startDate90, today),
		]);

		// Group completions by habit
		const habitCompletions = new Map<string, string[]>();
		for (const c of completions) {
			if (c.completed || (c.value && c.value > 0)) {
				if (!habitCompletions.has(c.habitId)) {
					habitCompletions.set(c.habitId, []);
				}
				habitCompletions.get(c.habitId)!.push(c.date);
			}
		}

		// Process each habit
		const habitStats: HabitStats[] = [];
		const allCompletedDates = new Map<string, Set<string>>(); // date -> set of habit IDs

		for (const habit of habits) {
			let completedDates: string[] = [];

			if (habit.type === "auto") {
				const autoRange = await getAutoHabitStatusRange(
					habit,
					startDate90,
					today,
				);
				completedDates = Object.keys(autoRange).filter((d) => autoRange[d]);
			} else {
				completedDates = habitCompletions.get(habit.id) || [];
			}

			// Track for heatmap
			for (const date of completedDates) {
				if (!allCompletedDates.has(date)) {
					allCompletedDates.set(date, new Set());
				}
				allCompletedDates.get(date)!.add(habit.id);
			}

			const { current, longest } = calculateStreaks(completedDates, today);
			const last30 = completedDates.filter((d) => d >= startDate30).length;
			const last7 = completedDates.filter((d) => d >= startDate7).length;

			habitStats.push({
				id: habit.id,
				name: habit.name,
				emoji: habit.emoji,
				type: habit.type,
				currentStreak: current,
				longestStreak: longest,
				last30Days: last30,
				last7Days: last7,
			});
		}

		// Build daily completions for heatmap (last 90 days)
		const dailyCompletions: DailyCompletion[] = [];
		const totalHabits = habits.length;

		for (let i = 0; i < 90; i++) {
			const date = new Date();
			date.setDate(date.getDate() - i);
			const dateStr = date.toISOString().split("T")[0];

			const completed = allCompletedDates.get(dateStr)?.size || 0;
			dailyCompletions.push({
				date: dateStr,
				completedCount: completed,
				totalCount: totalHabits,
				percentage:
					totalHabits > 0 ? Math.round((completed / totalHabits) * 100) : 0,
			});
		}

		return NextResponse.json({
			habits: habitStats,
			dailyCompletions: dailyCompletions.reverse(),
			totalHabits,
		});
	} catch (error) {
		console.error("Error in GET /api/habits/stats:", error);
		return NextResponse.json(
			{ error: "Failed to fetch stats" },
			{ status: 500 },
		);
	}
}
