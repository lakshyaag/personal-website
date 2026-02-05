/**
 * Logic for auto-derived habits
 */

import { supabaseAdmin } from "./supabase-client";
import type { Habit } from "./models";

type AutoSource = "workouts" | "food" | "journal" | "fits" | "visits";

// Map auto sources to their table and date column
const sourceConfig: Record<
	AutoSource,
	{ table: string; dateColumn: string }
> = {
	workouts: { table: "workout_logs", dateColumn: "log_date" },
	food: { table: "food_entries", dateColumn: "entry_date" },
	journal: { table: "journal_entries", dateColumn: "entry_date" },
	fits: { table: "fits_entries", dateColumn: "entry_date" },
	visits: { table: "visits", dateColumn: "visit_date" },
};

// Check if an auto habit is completed for a specific date
export async function getAutoHabitStatus(
	habit: Habit,
	date: string,
): Promise<boolean> {
	if (habit.type !== "auto" || !habit.autoSource) {
		return false;
	}

	const config = sourceConfig[habit.autoSource];
	const { count, error } = await supabaseAdmin
		.from(config.table)
		.select("*", { count: "exact", head: true })
		.eq(config.dateColumn, date);

	if (error) {
		console.error(`Error checking auto habit status:`, error);
		return false;
	}

	return (count ?? 0) > 0;
}

// Get auto habit status for a date range (returns map of date -> completed)
export async function getAutoHabitStatusRange(
	habit: Habit,
	startDate: string,
	endDate: string,
): Promise<Record<string, boolean>> {
	if (habit.type !== "auto" || !habit.autoSource) {
		return {};
	}

	const config = sourceConfig[habit.autoSource];
	const { data, error } = await supabaseAdmin
		.from(config.table)
		.select(config.dateColumn)
		.gte(config.dateColumn, startDate)
		.lte(config.dateColumn, endDate);

	if (error) {
		console.error(`Error checking auto habit status range:`, error);
		return {};
	}

	const result: Record<string, boolean> = {};
	for (const row of data || []) {
		const dateValue = row[config.dateColumn as keyof typeof row] as string;
		result[dateValue] = true;
	}

	return result;
}

// Count entries for a habit in a date range (for weekly targets)
export async function countAutoHabitInRange(
	habit: Habit,
	startDate: string,
	endDate: string,
): Promise<number> {
	if (habit.type !== "auto" || !habit.autoSource) {
		return 0;
	}

	const config = sourceConfig[habit.autoSource];

	// Count distinct dates with entries
	const { data, error } = await supabaseAdmin
		.from(config.table)
		.select(config.dateColumn)
		.gte(config.dateColumn, startDate)
		.lte(config.dateColumn, endDate);

	if (error) {
		console.error(`Error counting auto habit:`, error);
		return 0;
	}

	// Count unique dates
	const uniqueDates = new Set(
		(data || []).map((row) => row[config.dateColumn as keyof typeof row]),
	);
	return uniqueDates.size;
}
