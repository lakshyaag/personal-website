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

