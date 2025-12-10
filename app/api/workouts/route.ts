/**
 * Workout logs API routes
 * Migrated to use consolidated API route builder
 */

import { createCrudRoutes } from "@/lib/api-route-builder";
import {
	getWorkoutLogs,
	saveWorkoutLog,
	deleteWorkoutLog,
} from "@/lib/workouts-db";
import type { WorkoutLog } from "@/lib/models";

export const { GET, POST, DELETE } = createCrudRoutes<WorkoutLog>({
	dbOperations: {
		getAll: getWorkoutLogs,
		save: saveWorkoutLog,
		delete: deleteWorkoutLog,
	},
	entityName: "workout log",
	requiredFields: ["date"],
});

