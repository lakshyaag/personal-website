import { NextResponse } from "next/server";
import {
    getFoodEntries,
    getEntriesByDate,
    getEntriesGroupedByDate,
    getFoodEntryById,
    saveFoodEntry,
    deleteFoodEntry,
} from "@/lib/food-db";
import type { FoodEntry } from "@/lib/models";

/**
 * GET /api/food
 * Fetch food entries
 * Query params:
 * - date: Get entries for a specific date (YYYY-MM-DD)
 * - grouped: If "true", return entries grouped by date
 * - id: Get a single entry by ID
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const date = searchParams.get("date");
        const grouped = searchParams.get("grouped");
        const id = searchParams.get("id");

        if (id) {
            // Get entry by ID
            const entry = await getFoodEntryById(id);
            if (!entry) {
                return NextResponse.json(
                    { error: "Entry not found" },
                    { status: 404 },
                );
            }
            return NextResponse.json(entry);
        }

        if (date) {
            // Get entries for specific date
            const entries = await getEntriesByDate(date);
            return NextResponse.json(entries);
        }

        if (grouped === "true") {
            // Get entries grouped by date
            const groupedEntries = await getEntriesGroupedByDate();
            return NextResponse.json(groupedEntries);
        }

        // Get all entries
        const entries = await getFoodEntries();
        return NextResponse.json(entries);
    } catch (error) {
        console.error("Error in GET /api/food:", error);
        return NextResponse.json(
            { error: "Failed to fetch food entries" },
            { status: 500 },
        );
    }
}

/**
 * POST /api/food
 * Create or update a food entry
 */
export async function POST(req: Request) {
    try {
        const entry = (await req.json()) as FoodEntry;

        // Validate required fields
        if (!entry.date) {
            return NextResponse.json(
                { error: "Date is required" },
                { status: 400 },
            );
        }

        const id = await saveFoodEntry(entry);
        return NextResponse.json({ id });
    } catch (error) {
        console.error("Error in POST /api/food:", error);
        return NextResponse.json(
            { error: "Failed to save food entry" },
            { status: 500 },
        );
    }
}

/**
 * DELETE /api/food
 * Delete a food entry by ID
 * Query param: id
 */
export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                { error: "Entry ID is required" },
                { status: 400 },
            );
        }

        await deleteFoodEntry(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error in DELETE /api/food:", error);
        return NextResponse.json(
            { error: "Failed to delete food entry" },
            { status: 500 },
        );
    }
}
