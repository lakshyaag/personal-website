/**
 * Book recommendations database operations using Supabase
 * Replaces lib/recommendations-storage.ts
 */

import { supabaseAdmin } from "./supabase-client";
import {
	Recommendation,
	RecommendationDbRow,
	transformRecommendationFromDb,
	transformRecommendationToDb,
} from "./types";

/**
 * Get all recommendations, ordered by creation date (most recent first)
 */
export async function getRecommendations(): Promise<Recommendation[]> {
	const { data, error } = await supabaseAdmin
		.from("recommendations")
		.select("*")
		.order("created_at", { ascending: false });

	if (error) {
		console.error("Error fetching recommendations:", error);
		throw error;
	}

	return (data as RecommendationDbRow[]).map(transformRecommendationFromDb);
}

/**
 * Save a new recommendation
 * @param recommendation - Recommendation to save (without id and timestamp)
 * @returns The ID of the saved recommendation
 */
export async function saveRecommendation(
	recommendation: Omit<Recommendation, "id" | "timestamp">
): Promise<string> {
	const dbRec = transformRecommendationToDb(recommendation);

	const { data, error } = await supabaseAdmin
		.from("recommendations")
		.insert(dbRec)
		.select("id")
		.single();

	if (error) {
		console.error("Error saving recommendation:", error);
		throw error;
	}

	return data.id;
}

/**
 * Delete a recommendation by ID
 * @param id - Recommendation ID to delete
 */
export async function deleteRecommendation(id: string): Promise<void> {
	const { error } = await supabaseAdmin
		.from("recommendations")
		.delete()
		.eq("id", id);

	if (error) {
		console.error("Error deleting recommendation:", error);
		throw error;
	}
}
