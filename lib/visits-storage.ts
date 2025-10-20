import { put } from "@vercel/blob";
import type { Visit } from "./airports";

const VISITS_KEY = "airports/visits.json";

// Construct the public blob URL directly to avoid list() operations
function getVisitsUrl(): string {
	const token = process.env.BLOB_READ_WRITE_TOKEN;
	if (!token) throw new Error("BLOB_READ_WRITE_TOKEN not configured");

	// Extract store ID from token format: vercel_blob_rw_<storeId>_<secret>
	const parts = token.split("_");
	const storeId = parts[3]; // Position of storeId in token

	return `https://${storeId}.public.blob.vercel-storage.com/${VISITS_KEY}`;
}

export async function getVisits(): Promise<Visit[]> {
	try {
		const url = getVisitsUrl();
		const res = await fetch(url, { cache: "no-store" });

		// 404 means file doesn't exist yet - return empty array
		if (res.status === 404) {
			return [];
		}

		if (!res.ok) {
			throw new Error(`HTTP ${res.status}: ${res.statusText}`);
		}

		return await res.json();
	} catch (error) {
		console.error("Error fetching visits:", error);
		return [];
	}
}

export async function saveVisits(visits: Visit[]): Promise<void> {
	// put() is 1 operation - overwrites existing file
	await put(VISITS_KEY, JSON.stringify(visits), {
		access: "public",
        allowOverwrite: true,
		contentType: "application/json",
	});
}
