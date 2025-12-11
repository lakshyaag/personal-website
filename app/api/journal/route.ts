import { createCrudHandlers } from "@/lib/api-helpers";
import {
    getJournalEntries,
    getJournalEntryById,
    saveJournalEntry,
    deleteJournalEntry,
    getEntriesByDate,
    getEntriesGroupedByDate,
} from "@/lib/journal-db";

export const { GET, POST, DELETE } = createCrudHandlers(
    {
        getAll: getJournalEntries,
        getById: getJournalEntryById,
        save: saveJournalEntry,
        deleteById: deleteJournalEntry,
        getByDate: getEntriesByDate,
        getGroupedByDate: getEntriesGroupedByDate,
    },
    {
        entityName: "journal entry",
        requiredFields: ["date"],
        supportsDateFilter: true,
        supportsGrouped: true,
        supportsIdLookup: true,
    },
);
