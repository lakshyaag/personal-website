/**
 * Airport visits database operations using Supabase
 */

import { createDbOperations } from "./base-db";
import { supabaseAdmin } from "./supabase-client";
import {
	type Visit,
	type VisitDbRow,
	transformVisitFromDb,
	transformVisitToDb,
} from "./models";

const visitOps = createDbOperations<Visit, VisitDbRow>({
	table: "visits",
	dateColumn: "visit_date",
	orderBy: [{ column: "visit_date", ascending: false }],
	transformFromDb: transformVisitFromDb,
	transformToDb: transformVisitToDb,
});

// Export with original function names for backwards compatibility
export const getVisits = visitOps.getAll;
export const saveVisit = visitOps.save;
export const deleteVisit = visitOps.deleteById;

// Date-based operations
export const getVisitsByDate = visitOps.getByDate;
export const getVisitsGroupedByDate = visitOps.getGroupedByDate;

/**
 * Get visits for a specific airport
 * @param airportIdent - Airport identifier (e.g., "KJFK")
 */
export async function getVisitsByAirport(airportIdent: string): Promise<Visit[]> {
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
