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
 */
export async function getWorkoutLogsByDate(date: string): Promise<WorkoutLog[]> {
    const { data, error } = await supabaseAdmin
        .from("workout_logs")
        .select("*")
        .eq("log_date", date)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error fetching workout logs by date:", error);
        throw error;
    }

    return (data as WorkoutLogDbRow[]).map(transformWorkoutLogFromDb);
}

/**
 * Get workout logs grouped by date
 */
export async function getWorkoutLogsGrouped(): Promise<Record<string, WorkoutLog[]>> {
    const logs = await getWorkoutLogs();
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

