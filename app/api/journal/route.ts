/**
 * Journal entries API routes
 * Migrated to use consolidated API route builder
 */

import { createCrudRoutes } from "@/lib/api-route-builder";
import {
	getJournalEntries,
	getJournalEntryById,
	getEntriesByDate,
	getEntriesGroupedByDate,
	saveJournalEntry,
	deleteJournalEntry,
} from "@/lib/journal-db";
import type { JournalEntry } from "@/lib/models";

export const { GET, POST, DELETE } = createCrudRoutes<JournalEntry>({
	dbOperations: {
		getAll: getJournalEntries,
		getById: getJournalEntryById,
		getByDate: getEntriesByDate,
		getGrouped: getEntriesGroupedByDate,
		save: saveJournalEntry,
		delete: deleteJournalEntry,
	},
	entityName: "journal entry",
	requiredFields: ["date"],
});

