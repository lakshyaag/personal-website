/**
 * Journal database operations using Supabase
 */

import { createDbOperations } from "./base-db";
import {
    type JournalEntry,
    type JournalEntryDbRow,
    transformJournalEntryFromDb,
    transformJournalEntryToDb,
} from "./models";

const journalOps = createDbOperations<JournalEntry, JournalEntryDbRow>({
    table: "journal_entries",
    dateColumn: "entry_date",
    orderBy: [
        { column: "entry_date", ascending: false },
        { column: "created_at", ascending: false },
    ],
    transformFromDb: transformJournalEntryFromDb,
    transformToDb: transformJournalEntryToDb,
});

// Export with original function names for backwards compatibility
export const getJournalEntries = journalOps.getAll;
export const getJournalEntryById = journalOps.getById;
export const saveJournalEntry = journalOps.save;
export const deleteJournalEntry = journalOps.deleteById;
export const getEntriesByDate = journalOps.getByDate;
export const getEntriesGroupedByDate = journalOps.getGroupedByDate;
