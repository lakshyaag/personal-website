/**
 * Food database operations using Supabase
 */

import { supabaseAdmin } from "./supabase-client";
import {
    type FoodEntry,
    type FoodEntryDbRow,
    transformFoodEntryFromDb,
    transformFoodEntryToDb,
} from "./models";

/**
 * Get all food entries, ordered by date (desc) then created_at (desc)
 */
export async function getFoodEntries(): Promise<FoodEntry[]> {
    const { data, error } = await supabaseAdmin
        .from("food_entries")
        .select("*")
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error fetching food entries:", error);
        throw error;
    }

    return (data as FoodEntryDbRow[]).map(transformFoodEntryFromDb);
}

/**
 * Get food entries for a specific date
 * @param date - Date string in YYYY-MM-DD format
 */
export async function getEntriesByDate(date: string): Promise<FoodEntry[]> {
    const { data, error } = await supabaseAdmin
        .from("food_entries")
        .select("*")
        .eq("entry_date", date)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error fetching entries by date:", error);
        throw error;
    }

    return (data as FoodEntryDbRow[]).map(transformFoodEntryFromDb);
}

/**
 * Get a food entry by ID
 * @param id - Entry ID
 */
export async function getFoodEntryById(id: string): Promise<FoodEntry | null> {
    const { data, error } = await supabaseAdmin
        .from("food_entries")
        .select("*")
        .eq("id", id)
        .single();

    if (error) {
        if (error.code === "PGRST116") {
            // No rows returned
            return null;
        }
        console.error("Error fetching food entry by ID:", error);
        throw error;
    }

    return transformFoodEntryFromDb(data as FoodEntryDbRow);
}

/**
 * Get food entries grouped by date
 * Returns an object with dates as keys and arrays of entries as values
 */
export async function getEntriesGroupedByDate(): Promise<
    Record<string, FoodEntry[]>
> {
    const entries = await getFoodEntries();

    // Group entries by date
    const grouped: Record<string, FoodEntry[]> = {};
    for (const entry of entries) {
        if (!grouped[entry.date]) {
            grouped[entry.date] = [];
        }
        grouped[entry.date].push(entry);
    }

    return grouped;
}

/**
 * Create or update a food entry
 * @param entry - Food entry to save (with or without ID)
 * @returns The ID of the saved entry
 */
export async function saveFoodEntry(entry: FoodEntry): Promise<string> {
    const dbEntry = transformFoodEntryToDb(entry);

    const { data, error } = await supabaseAdmin
        .from("food_entries")
        .upsert(dbEntry)
        .select("id")
        .single();

    if (error) {
        console.error("Error saving food entry:", error);
        throw error;
    }

    return data.id;
}

/**
 * Delete a food entry by ID
 * @param id - Entry ID to delete
 */
export async function deleteFoodEntry(id: string): Promise<void> {
    const { error } = await supabaseAdmin
        .from("food_entries")
        .delete()
        .eq("id", id);

    if (error) {
        console.error("Error deleting food entry:", error);
        throw error;
    }
}
