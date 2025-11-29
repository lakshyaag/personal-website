/**
 * Airports database operations using Supabase
 * Provides access to the airports reference table
 */

import { supabaseAdmin } from "./supabase-client";
import { Airport } from "./airports";

/**
 * Get all airports
 */
export async function getAirports(): Promise<Airport[]> {
	const { data, error } = await supabaseAdmin
		.from("airports")
		.select("*")
		.order("name", { ascending: true });

	if (error) {
		console.error("Error fetching airports:", error);
		throw error;
	}

	return data as Airport[];
}

/**
 * Get airport by identifier (e.g., "KJFK")
 */
export async function getAirportByIdent(ident: string): Promise<Airport | null> {
	const { data, error } = await supabaseAdmin
		.from("airports")
		.select("*")
		.eq("ident", ident)
		.single();

	if (error) {
		if (error.code === "PGRST116") {
			return null;
		}
		console.error("Error fetching airport:", error);
		throw error;
	}

	return data as Airport;
}

/**
 * Get airport by IATA code (e.g., "JFK")
 */
export async function getAirportByIata(iataCode: string): Promise<Airport | null> {
	const { data, error } = await supabaseAdmin
		.from("airports")
		.select("*")
		.eq("iata_code", iataCode)
		.single();

	if (error) {
		if (error.code === "PGRST116") {
			return null;
		}
		console.error("Error fetching airport by IATA:", error);
		throw error;
	}

	return data as Airport;
}

/**
 * Search airports by name or IATA code
 */
export async function searchAirports(query: string): Promise<Airport[]> {
	const upperQuery = query.toUpperCase();

	const { data, error } = await supabaseAdmin
		.from("airports")
		.select("*")
		.or(
			`name.ilike.%${query}%,iata_code.ilike.%${upperQuery}%,ident.ilike.%${upperQuery}%`
		)
		.order("name", { ascending: true })
		.limit(50);

	if (error) {
		console.error("Error searching airports:", error);
		throw error;
	}

	return data as Airport[];
}
