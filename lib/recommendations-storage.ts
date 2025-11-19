import { put } from "@vercel/blob";

const RECOMMENDATIONS_KEY = "books/recommendations.json";

export interface Recommendation {
    id: string;
    bookName: string;
    bookAuthor?: string;
    bookCoverUrl?: string;
    googleBooksId?: string;
    recommenderName?: string;
    comment?: string;
    timestamp: number;
}

function getRecommendationsUrl(): string {
    const token = process.env.BLOB_READ_WRITE_TOKEN;
    if (!token) throw new Error("BLOB_READ_WRITE_TOKEN not configured");

    const parts = token.split("_");
    const storeId = parts[3];

    return `https://${storeId}.public.blob.vercel-storage.com/${RECOMMENDATIONS_KEY}`;
}

export async function getRecommendations(): Promise<Recommendation[]> {
    try {
        const url = getRecommendationsUrl();
        const res = await fetch(url, { cache: "no-store" });

        if (res.status === 404) {
            return [];
        }

        if (!res.ok) {
            throw new Error(`HTTP ${res.status}: ${res.statusText}`);
        }

        return await res.json();
    } catch (error) {
        console.error("Error fetching recommendations:", error);
        return [];
    }
}

export async function saveRecommendation(recommendation: Recommendation): Promise<void> {
    const currentRecommendations = await getRecommendations();
    // Ensure ID is present
    const recWithId = {
        ...recommendation,
        id: recommendation.id || crypto.randomUUID()
    };

    const newRecommendations = [recWithId, ...currentRecommendations];

    await put(RECOMMENDATIONS_KEY, JSON.stringify(newRecommendations), {
        access: "public",
        allowOverwrite: true,
        contentType: "application/json",
    });
}

export async function deleteRecommendation(id: string): Promise<void> {
    const currentRecommendations = await getRecommendations();
    const newRecommendations = currentRecommendations.filter(rec => rec.id !== id);

    await put(RECOMMENDATIONS_KEY, JSON.stringify(newRecommendations), {
        access: "public",
        allowOverwrite: true,
        contentType: "application/json",
    });
}
