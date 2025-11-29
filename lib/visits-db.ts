/**
 * Airport visits database operations using Supabase
 * Replaces lib/visits-storage.ts
 */

import { supabaseAdmin } from "./supabase-client";
import {
	Visit,
	VisitDbRow,
	transformVisitFromDb,
	transformVisitToDb,
} from "./airports";

/**
 * Get all visits, ordered by date (most recent first)
 */
export async function getVisits(): Promise<Visit[]> {
	const { data, error } = await supabaseAdmin
		.from("visits")
		.select("*")
		.order("visit_date", { ascending: false });

	if (error) {
		console.error("Error fetching visits:", error);
		throw error;
	}

	return (data as VisitDbRow[]).map(transformVisitFromDb);
}

/**
 * Create or update a visit
 * @param visit - Visit entry to save
 * @returns The ID of the saved visit
 */
export async function saveVisit(visit: Visit): Promise<string> {
	const dbVisit = transformVisitToDb(visit);

	const { data, error } = await supabaseAdmin
		.from("visits")
		.upsert(dbVisit)
		.select("id")
		.single();

	if (error) {
		console.error("Error saving visit:", error);
		throw error;
	}

	return data.id;
}

/**
 * Delete a visit by ID
 * @param id - Visit ID to delete
 */
export async function deleteVisit(id: string): Promise<void> {
	const { error } = await supabaseAdmin.from("visits").delete().eq("id", id);

	if (error) {
		console.error("Error deleting visit:", error);
		throw error;
	}
}

/**
 * Get visits for a specific airport
 * @param airportIdent - Airport identifier (e.g., "KJFK")
 */
export async function getVisitsByAirport(
	airportIdent: string
): Promise<Visit[]> {
	const { data, error } = await supabaseAdmin
		.from("visits")
		.select("*")
		.eq("airport_ident", airportIdent)
		.order("visit_date", { ascending: false });

	if (error) {
		console.error("Error fetching visits by airport:", error);
		throw error;
	}

	return (data as VisitDbRow[]).map(transformVisitFromDb);
}
