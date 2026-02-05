import { NextResponse } from "next/server";
import {
	getActiveHabits,
	getCompletionsByDate,
	getCompletionsInRange,
} from "@/lib/habits-db";
import {
	getAutoHabitStatus,
	getAutoHabitStatusRange,
} from "@/lib/habits-auto";
import type { Habit, HabitCompletion } from "@/lib/models";

interface HabitWithStatus extends Habit {
	completedToday: boolean;
	todayValue?: number;
	currentStreak: number;
	completionId?: string; // For editing existing completions
}

// Calculate streak for a habit given completion dates
function calculateStreak(completedDates: Set<string>, fromDate: string): number {
	let streak = 0;
	const date = new Date(fromDate);

	while (true) {
		const dateStr = date.toISOString().split("T")[0];
		if (completedDates.has(dateStr)) {
			streak++;
			date.setDate(date.getDate() - 1);
		} else {
			break;
		}
	}

	return streak;
}

export async function GET(req: Request) {
	try {
		const { searchParams } = new URL(req.url);
		const dateParam = searchParams.get("date");
		const today = dateParam || new Date().toISOString().split("T")[0];

		// Get last 90 days for streak calculation
		const streakStartDate = new Date(today);
		streakStartDate.setDate(streakStartDate.getDate() - 90);
		const startDateStr = streakStartDate.toISOString().split("T")[0];

		// Fetch all data in parallel
		const [habits, todayCompletions, rangeCompletions] = await Promise.all([
			getActiveHabits(),
			getCompletionsByDate(today),
			getCompletionsInRange(startDateStr, today),
		]);

		// Build completion lookup maps
		const todayCompletionMap = new Map<string, HabitCompletion>();
		for (const c of todayCompletions) {
			todayCompletionMap.set(c.habitId, c);
		}

		// Group range completions by habit
		const habitCompletionDates = new Map<string, Set<string>>();
		for (const c of rangeCompletions) {
			if (!habitCompletionDates.has(c.habitId)) {
				habitCompletionDates.set(c.habitId, new Set());
			}
			if (c.completed || (c.value && c.value > 0)) {
				habitCompletionDates.get(c.habitId)!.add(c.date);
			}
		}

		// Process each habit
		const results: HabitWithStatus[] = [];

		for (const habit of habits) {
			let completedToday = false;
			let todayValue: number | undefined;
			let completionId: string | undefined;
			let completedDates = habitCompletionDates.get(habit.id) || new Set<string>();

			if (habit.type === "auto") {
				// Check auto source for today
				completedToday = await getAutoHabitStatus(habit, today);

				// Get auto completions for streak
				const autoRange = await getAutoHabitStatusRange(
					habit,
					startDateStr,
					today,
				);
				completedDates = new Set(
					Object.keys(autoRange).filter((d) => autoRange[d]),
				);
			} else {
				// Check manual completion
				const completion = todayCompletionMap.get(habit.id);
				if (completion) {
					completedToday =
						completion.completed ||
						(completion.value !== undefined && completion.value > 0);
					todayValue = completion.value;
					completionId = completion.id;
				}
			}

			// Add today to completed dates if completed
			if (completedToday) {
				completedDates.add(today);
			}

			const currentStreak = calculateStreak(completedDates, today);

			results.push({
				...habit,
				completedToday,
				todayValue,
				currentStreak,
				completionId,
			});
		}

		return NextResponse.json({
			date: today,
			habits: results,
		});
	} catch (error) {
		console.error("Error in GET /api/habits/today:", error);
		return NextResponse.json(
			{ error: "Failed to fetch habits" },
			{ status: 500 },
		);
	}
}
