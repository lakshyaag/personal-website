/**
 * AI Metadata database operations using Supabase
 */

import { supabaseAdmin } from "@/lib/supabase-client";
import {
	type AIMetadata,
	type AIMetadataDbRow,
	transformAIMetadataFromDb,
	transformAIMetadataToDb,
} from "./models";

export async function saveAIMetadata(
	metadata: Omit<AIMetadata, "id" | "createdAt">,
): Promise<string> {
	const dbData = transformAIMetadataToDb(metadata);

	const { data, error } = await supabaseAdmin
		.from("ai_metadata")
		.insert(dbData)
		.select("id")
		.single();

	if (error) {
		console.error("Error saving AI metadata:", error);
		throw error;
	}

	return data.id;
}