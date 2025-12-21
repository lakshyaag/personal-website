/**
 * Fits database operations using Supabase
 */

import { createDbOperations } from "./base-db";
import {
    type FitsEntry,
    type FitsEntryDbRow,
    transformFitsEntryFromDb,
    transformFitsEntryToDb,
} from "./models";

const fitsOps = createDbOperations<FitsEntry, FitsEntryDbRow>({
    table: "fits_entries",
    dateColumn: "entry_date",
    orderBy: [
        { column: "entry_date", ascending: false },
        { column: "created_at", ascending: false },
    ],
    transformFromDb: transformFitsEntryFromDb,
    transformToDb: transformFitsEntryToDb,
});

// Export with original function names for backwards compatibility
export const getFitsEntries = fitsOps.getAll;
export const getFitsEntryById = fitsOps.getById;
export const saveFitsEntry = fitsOps.save;
export const deleteFitsEntry = fitsOps.deleteById;
export const getEntriesByDate = fitsOps.getByDate;
export const getEntriesGroupedByDate = fitsOps.getGroupedByDate;

