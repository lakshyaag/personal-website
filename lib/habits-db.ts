/**
 * Habits database operations using Supabase
 */

import { createDbOperations } from "./base-db";
import {
	type Habit,
	type HabitDbRow,
	type HabitCompletion,
	type HabitCompletionDbRow,
	transformHabitFromDb,
	transformHabitToDb,
	transformHabitCompletionFromDb,
	transformHabitCompletionToDb,
} from "./models";
import { supabaseAdmin } from "./supabase-client";

// Habits CRUD (no date column, ordered by display_order)
const habitOps = createDbOperations<Habit, HabitDbRow>({
	table: "habits",
	orderBy: [{ column: "display_order", ascending: true }],
	transformFromDb: transformHabitFromDb,
	transformToDb: transformHabitToDb,
});

export const getAllHabits = habitOps.getAll;
export const getHabitById = habitOps.getById;
export const saveHabit = habitOps.save;
export const deleteHabitById = habitOps.deleteById;

// Get only active (non-archived) habits
export async function getActiveHabits(): Promise<Habit[]> {
	const { data, error } = await supabaseAdmin
		.from("habits")
		.select("*")
		.eq("archived", false)
		.order("display_order", { ascending: true });

	if (error) throw error;
	return (data as HabitDbRow[]).map(transformHabitFromDb);
}

// Completions CRUD (with date column)
const completionOps = createDbOperations<HabitCompletion, HabitCompletionDbRow>({
	table: "habit_completions",
	dateColumn: "completion_date",
	orderBy: [{ column: "completion_date", ascending: false }],
	transformFromDb: transformHabitCompletionFromDb,
	transformToDb: transformHabitCompletionToDb,
});

export const getAllCompletions = completionOps.getAll;
export const getCompletionById = completionOps.getById;
export const saveCompletion = completionOps.save;
export const deleteCompletionById = completionOps.deleteById;
export const getCompletionsByDate = completionOps.getByDate;

// Get completions for a specific habit
export async function getCompletionsForHabit(
	habitId: string,
): Promise<HabitCompletion[]> {
	const { data, error } = await supabaseAdmin
		.from("habit_completions")
		.select("*")
		.eq("habit_id", habitId)
		.order("completion_date", { ascending: false });

	if (error) throw error;
	return (data as HabitCompletionDbRow[]).map(transformHabitCompletionFromDb);
}

// Get completion for a specific habit on a specific date
export async function getCompletionForHabitOnDate(
	habitId: string,
	date: string,
): Promise<HabitCompletion | null> {
	const { data, error } = await supabaseAdmin
		.from("habit_completions")
		.select("*")
		.eq("habit_id", habitId)
		.eq("completion_date", date)
		.single();

	if (error) {
		if (error.code === "PGRST116") return null;
		throw error;
	}
	return transformHabitCompletionFromDb(data as HabitCompletionDbRow);
}

// Get all completions for a date range
export async function getCompletionsInRange(
	startDate: string,
	endDate: string,
): Promise<HabitCompletion[]> {
	const { data, error } = await supabaseAdmin
		.from("habit_completions")
		.select("*")
		.gte("completion_date", startDate)
		.lte("completion_date", endDate)
		.order("completion_date", { ascending: false });

	if (error) throw error;
	return (data as HabitCompletionDbRow[]).map(transformHabitCompletionFromDb);
}
