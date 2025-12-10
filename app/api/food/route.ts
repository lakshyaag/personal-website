/**
 * Food entries API routes
 * Migrated to use consolidated API route builder
 */

import { createCrudRoutes } from "@/lib/api-route-builder";
import {
	getFoodEntries,
	getFoodEntryById,
	getEntriesByDate,
	getEntriesGroupedByDate,
	saveFoodEntry,
	deleteFoodEntry,
} from "@/lib/food-db";
import type { FoodEntry } from "@/lib/models";

export const { GET, POST, DELETE } = createCrudRoutes<FoodEntry>({
	dbOperations: {
		getAll: getFoodEntries,
		getById: getFoodEntryById,
		getByDate: getEntriesByDate,
		getGrouped: getEntriesGroupedByDate,
		save: saveFoodEntry,
		delete: deleteFoodEntry,
	},
	entityName: "food entry",
	requiredFields: ["date"],
});
