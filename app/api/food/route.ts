import { createCrudHandlers } from "@/lib/api-helpers";
import {
	deleteFoodEntry,
	getEntriesByDate,
	getEntriesGroupedByDate,
	getFoodEntries,
	getFoodEntryById,
	saveFoodEntry,
} from "@/lib/food-db";

export const { GET, POST, DELETE } = createCrudHandlers(
	{
		getAll: getFoodEntries,
		getById: getFoodEntryById,
		save: saveFoodEntry,
		deleteById: deleteFoodEntry,
		getByDate: getEntriesByDate,
		getGroupedByDate: getEntriesGroupedByDate,
	},
	{
		entityName: "food entry",
		requiredFields: ["date"],
		supportsDateFilter: true,
		supportsGrouped: true,
		supportsIdLookup: true,
	},
);
