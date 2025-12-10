/**
 * Workout logs database operations using Supabase
 */

import { supabaseAdmin } from "./supabase-client";
import {
    type WorkoutLog,
    type WorkoutLogDbRow,
    transformWorkoutLogFromDb,
    transformWorkoutLogToDb,
} from "./models";

/**
 * Get all workout logs, ordered by date (most recent first)
 */
export async function getWorkoutLogs(): Promise<WorkoutLog[]> {
    const { data, error } = await supabaseAdmin
        .from("workout_logs")
        .select("*")
        .order("log_date", { ascending: false });

    if (error) {
        console.error("Error fetching workout logs:", error);
        throw error;
    }

    return (data as WorkoutLogDbRow[]).map(transformWorkoutLogFromDb);
}

/**
 * Get workout logs for a specific date
 * @param date - Date string in YYYY-MM-DD format
 */
export async function getLogsByDate(date: string): Promise<WorkoutLog[]> {
    const { data, error } = await supabaseAdmin
        .from("workout_logs")
        .select("*")
        .eq("log_date", date)
        .order("log_date", { ascending: false });

    if (error) {
        console.error("Error fetching logs by date:", error);
        throw error;
    }

    return (data as WorkoutLogDbRow[]).map(transformWorkoutLogFromDb);
}

/**
 * Get a workout log by ID
 * @param id - Log ID
 */
export async function getWorkoutLogById(id: string): Promise<WorkoutLog | null> {
    const { data, error } = await supabaseAdmin
        .from("workout_logs")
        .select("*")
        .eq("id", id)
        .single();

    if (error) {
        if (error.code === "PGRST116") {
            // No rows returned
            return null;
        }
        console.error("Error fetching workout log by ID:", error);
        throw error;
    }

    return transformWorkoutLogFromDb(data as WorkoutLogDbRow);
}

/**
 * Get workout logs grouped by date
 * Returns an object with dates as keys and arrays of logs as values
 */
export async function getLogsGroupedByDate(): Promise<
    Record<string, WorkoutLog[]>
> {
    const logs = await getWorkoutLogs();

    // Group logs by date
    const grouped: Record<string, WorkoutLog[]> = {};
    for (const log of logs) {
        if (!grouped[log.date]) {
            grouped[log.date] = [];
        }
        grouped[log.date].push(log);
    }

    return grouped;
}

/**
 * Create or update a workout log
 * @param log - Workout log entry to save
 * @returns The ID of the saved log
 */
export async function saveWorkoutLog(log: WorkoutLog): Promise<string> {
    const dbLog = transformWorkoutLogToDb(log);

    const { data, error } = await supabaseAdmin
        .from("workout_logs")
        .upsert(dbLog)
        .select("id")
        .single();

    if (error) {
        console.error("Error saving workout log:", error);
        throw error;
    }

    return data.id;
}

/**
 * Delete a workout log by ID
 * @param id - Workout log ID to delete
 */
export async function deleteWorkoutLog(id: string): Promise<void> {
    const { error } = await supabaseAdmin
        .from("workout_logs")
        .delete()
        .eq("id", id);

    if (error) {
        console.error("Error deleting workout log:", error);
        throw error;
    }
}

