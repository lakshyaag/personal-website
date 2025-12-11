/**
 * Food database operations using Supabase
 */

import { createDbOperations } from "./base-db";
import {
    type FoodEntry,
    type FoodEntryDbRow,
    transformFoodEntryFromDb,
    transformFoodEntryToDb,
} from "./models";

const foodOps = createDbOperations<FoodEntry, FoodEntryDbRow>({
    table: "food_entries",
    dateColumn: "entry_date",
    orderBy: [
        { column: "entry_date", ascending: false },
        { column: "created_at", ascending: false },
    ],
    transformFromDb: transformFoodEntryFromDb,
    transformToDb: transformFoodEntryToDb,
});

// Export with original function names for backwards compatibility
export const getFoodEntries = foodOps.getAll;
export const getFoodEntryById = foodOps.getById;
export const saveFoodEntry = foodOps.save;
export const deleteFoodEntry = foodOps.deleteById;
export const getEntriesByDate = foodOps.getByDate;
export const getEntriesGroupedByDate = foodOps.getGroupedByDate;
