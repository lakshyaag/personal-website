/**
 * Books database operations using Supabase
 * Replaces lib/books-storage.ts
 */

import { supabaseAdmin } from "./supabase-client";
import {
	BookEntry,
	BookDbRow,
	transformBookFromDb,
	transformBookToDb,
} from "./models";

/**
 * Get all books, ordered by date started (most recent first)
 */
export async function getBooks(): Promise<BookEntry[]> {
	const { data, error } = await supabaseAdmin
		.from("books")
		.select("*")
		.order("date_started", { ascending: false });

	if (error) {
		console.error("Error fetching books:", error);
		throw error;
	}

	return (data as BookDbRow[]).map(transformBookFromDb);
}

/**
 * Create or update a book
 * @param book - Book entry to save (with or without ID)
 * @returns The ID of the saved book
 */
export async function saveBook(book: BookEntry): Promise<string> {
	const dbBook = transformBookToDb(book);

	const { data, error } = await supabaseAdmin
		.from("books")
		.upsert(dbBook)
		.select("id")
		.single();

	if (error) {
		console.error("Error saving book:", error);
		throw error;
	}

	return data.id;
}

/**
 * Delete a book by ID
 * @param id - Book ID to delete
 */
export async function deleteBook(id: string): Promise<void> {
	const { error } = await supabaseAdmin.from("books").delete().eq("id", id);

	if (error) {
		console.error("Error deleting book:", error);
		throw error;
	}
}

/**
 * Set a book as the current book (clears is_current flag on all others)
 * @param id - Book ID to set as current
 */
export async function setCurrentBook(id: string): Promise<void> {
	// Clear all current flags first
	const { error: clearError } = await supabaseAdmin
		.from("books")
		.update({ is_current: false })
		.eq("is_current", true);

	if (clearError) {
		console.error("Error clearing current book flags:", clearError);
		throw clearError;
	}

	// Set the new current book
	const { error: setError } = await supabaseAdmin
		.from("books")
		.update({ is_current: true })
		.eq("id", id);

	if (setError) {
		console.error("Error setting current book:", setError);
		throw setError;
	}
}

/**
 * Get the currently reading book
 */
export async function getCurrentBook(): Promise<BookEntry | null> {
	const { data, error } = await supabaseAdmin
		.from("books")
		.select("*")
		.eq("is_current", true)
		.single();

	if (error) {
		// Not finding a current book is not an error
		if (error.code === "PGRST116") {
			return null;
		}
		console.error("Error fetching current book:", error);
		throw error;
	}

	return transformBookFromDb(data as BookDbRow);
}
