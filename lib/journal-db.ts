/**
 * Journal database operations using Supabase
 */

import { supabaseAdmin } from "./supabase-client";
import {
    type JournalEntry,
    type JournalEntryDbRow,
    transformJournalEntryFromDb,
    transformJournalEntryToDb,
} from "./models";

/**
 * Get all journal entries, ordered by date (desc) then created_at (desc)
 */
export async function getJournalEntries(): Promise<JournalEntry[]> {
    const { data, error } = await supabaseAdmin
        .from("journal_entries")
        .select("*")
        .order("entry_date", { ascending: false })
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error fetching journal entries:", error);
        throw error;
    }

    return (data as JournalEntryDbRow[]).map(transformJournalEntryFromDb);
}

/**
 * Get journal entries for a specific date
 * @param date - Date string in YYYY-MM-DD format
 */
export async function getEntriesByDate(date: string): Promise<JournalEntry[]> {
    const { data, error } = await supabaseAdmin
        .from("journal_entries")
        .select("*")
        .eq("entry_date", date)
        .order("created_at", { ascending: false });

    if (error) {
        console.error("Error fetching entries by date:", error);
        throw error;
    }

    return (data as JournalEntryDbRow[]).map(transformJournalEntryFromDb);
}

/**
 * Get a journal entry by ID
 * @param id - Entry ID
 */
export async function getJournalEntryById(id: string): Promise<JournalEntry | null> {
    const { data, error } = await supabaseAdmin
        .from("journal_entries")
        .select("*")
        .eq("id", id)
        .single();

    if (error) {
        if (error.code === "PGRST116") {
            // No rows returned
            return null;
        }
        console.error("Error fetching journal entry by ID:", error);
        throw error;
    }

    return transformJournalEntryFromDb(data as JournalEntryDbRow);
}

/**
 * Get journal entries grouped by date
 * Returns an object with dates as keys and arrays of entries as values
 */
export async function getEntriesGroupedByDate(): Promise<
    Record<string, JournalEntry[]>
> {
    const entries = await getJournalEntries();

    // Group entries by date
    const grouped: Record<string, JournalEntry[]> = {};
    for (const entry of entries) {
        if (!grouped[entry.date]) {
            grouped[entry.date] = [];
        }
        grouped[entry.date].push(entry);
    }

    return grouped;
}

/**
 * Create or update a journal entry
 * @param entry - Journal entry to save (with or without ID)
 * @returns The ID of the saved entry
 */
export async function saveJournalEntry(entry: JournalEntry): Promise<string> {
    const dbEntry = transformJournalEntryToDb(entry);

    const { data, error } = await supabaseAdmin
        .from("journal_entries")
        .upsert(dbEntry)
        .select("id")
        .single();

    if (error) {
        console.error("Error saving journal entry:", error);
        throw error;
    }

    return data.id;
}

/**
 * Delete a journal entry by ID
 * @param id - Entry ID to delete
 */
export async function deleteJournalEntry(id: string): Promise<void> {
    const { error } = await supabaseAdmin
        .from("journal_entries")
        .delete()
        .eq("id", id);

    if (error) {
        console.error("Error deleting journal entry:", error);
        throw error;
    }
}

