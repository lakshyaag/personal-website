import { createCrudHandlers } from "@/lib/api-helpers";
import {
	deleteFitsEntry,
	getEntriesByDate,
	getEntriesGroupedByDate,
	getFitsEntries,
	getFitsEntryById,
	saveFitsEntry,
} from "@/lib/fits-db";

export const { GET, POST, DELETE } = createCrudHandlers(
	{
		getAll: getFitsEntries,
		getById: getFitsEntryById,
		save: saveFitsEntry,
		deleteById: deleteFitsEntry,
		getByDate: getEntriesByDate,
		getGroupedByDate: getEntriesGroupedByDate,
	},
	{
		entityName: "fits entry",
		requiredFields: ["date"],
		supportsDateFilter: true,
		supportsGrouped: true,
		supportsIdLookup: true,
	},
);
