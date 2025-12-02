import { NextResponse } from "next/server";
import {
    getJournalEntries,
    getEntriesByDate,
    getEntriesGroupedByDate,
    getJournalEntryById,
    saveJournalEntry,
    deleteJournalEntry,
} from "@/lib/journal-db";
import type { JournalEntry } from "@/lib/models";

/**
 * GET /api/journal
 * Fetch journal entries
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
            const entry = await getJournalEntryById(id);
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
        const entries = await getJournalEntries();
        return NextResponse.json(entries);
    } catch (error) {
        console.error("Error in GET /api/journal:", error);
        return NextResponse.json(
            { error: "Failed to fetch journal entries" },
            { status: 500 },
        );
    }
}

/**
 * POST /api/journal
 * Create or update a journal entry
 */
export async function POST(req: Request) {
    try {
        const entry = (await req.json()) as JournalEntry;

        // Validate required fields
        if (!entry.date) {
            return NextResponse.json(
                { error: "Date is required" },
                { status: 400 },
            );
        }

        const id = await saveJournalEntry(entry);
        return NextResponse.json({ id });
    } catch (error) {
        console.error("Error in POST /api/journal:", error);
        return NextResponse.json(
            { error: "Failed to save journal entry" },
            { status: 500 },
        );
    }
}

/**
 * DELETE /api/journal
 * Delete a journal entry by ID
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

        await deleteJournalEntry(id);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error in DELETE /api/journal:", error);
        return NextResponse.json(
            { error: "Failed to delete journal entry" },
            { status: 500 },
        );
    }
}

