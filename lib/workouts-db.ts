/**
 * Workout logs database operations using Supabase
 */

import { createDbOperations } from "./base-db";
import {
	type WorkoutLog,
	type WorkoutLogDbRow,
	transformWorkoutLogFromDb,
	transformWorkoutLogToDb,
} from "./models";

const workoutOps = createDbOperations<WorkoutLog, WorkoutLogDbRow>({
	table: "workout_logs",
	dateColumn: "log_date",
	orderBy: [{ column: "log_date", ascending: false }],
	transformFromDb: transformWorkoutLogFromDb,
	transformToDb: transformWorkoutLogToDb,
});

// Export with original function names for backwards compatibility
export const getWorkoutLogs = workoutOps.getAll;
export const saveWorkoutLog = workoutOps.save;
export const deleteWorkoutLog = workoutOps.deleteById;

// Date-based operations
export const getWorkoutLogsByDate = workoutOps.getByDate;
export const getWorkoutLogsGroupedByDate = workoutOps.getGroupedByDate;
