import { list, put } from "@vercel/blob";
import type { Visit } from "./airports";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";

const VISITS_KEY = "airports/visits.json";
const LOCAL_VISITS_PATH = join(process.cwd(), "data", "visits.json");


export async function getVisits(): Promise<Visit[]> {
    // Use local JSON file in development or when Vercel Blob is not available
    if (process.env.NODE_ENV === "development") {
        try {
            const data = readFileSync(LOCAL_VISITS_PATH, "utf-8");
            return JSON.parse(data);
        } catch (localError) {
            console.error("Error reading local visits file:", localError);
            return [];
        }
    }

    // Try Vercel Blob first in production
    try {
        const items = await list({ prefix: "airports/" });
        const file = items.blobs.find((b) => b.pathname === VISITS_KEY);
        if (!file) throw new Error("No visits file found in blob storage");

        const res = await fetch(file.url, { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

        return await res.json();
    } catch (error) {
        console.error("Error fetching visits from Vercel Blob, falling back to local file:", error);

        // Fall back to local JSON file
        try {
            const data = readFileSync(LOCAL_VISITS_PATH, "utf-8");
            return JSON.parse(data);
        } catch (localError) {
            console.error("Error reading local visits file:", localError);
            return [];
        }
    }
}

export async function saveVisits(visits: Visit[]): Promise<void> {
    // Use local JSON file in development
    if (process.env.NODE_ENV === "development") {
        try {
            writeFileSync(LOCAL_VISITS_PATH, JSON.stringify(visits, null, 2));
            return;
        } catch (localError) {
            console.error("Error writing local visits file:", localError);
            throw localError;
        }
    }

    try {
        await put(VISITS_KEY, JSON.stringify(visits), {
            access: "public",
            contentType: "application/json",
        });
    } catch (error) {
        console.error("Error saving visits to Vercel Blob:", error);
        throw error;
    }
}