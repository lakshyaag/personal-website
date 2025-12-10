import { NextResponse } from "next/server";
import {
    getWorkoutLogs,
    getLogsByDate,
    getLogsGroupedByDate,
    getWorkoutLogById,
    saveWorkoutLog,
    deleteWorkoutLog,
} from "@/lib/workouts-db";
import type { WorkoutLog } from "@/lib/models";
import { randomUUID } from "node:crypto";

/**
 * GET /api/workouts
 * Fetch workout logs
 * Query params:
 * - date: Get logs for a specific date (YYYY-MM-DD)
 * - grouped: If "true", return logs grouped by date
 * - id: Get a single log by ID
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const date = searchParams.get("date");
        const grouped = searchParams.get("grouped");
        const id = searchParams.get("id");

        if (id) {
            // Get log by ID
            const log = await getWorkoutLogById(id);
            if (!log) {
                return NextResponse.json(
                    { error: "Log not found" },
                    { status: 404 },
                );
            }
            return NextResponse.json(log);
        }

        if (date) {
            // Get logs for specific date
            const logs = await getLogsByDate(date);
            return NextResponse.json(logs);
        }

        if (grouped === "true") {
            // Get logs grouped by date
            const groupedLogs = await getLogsGroupedByDate();
            return NextResponse.json(groupedLogs);
        }

        // Get all logs
        const logs = await getWorkoutLogs();
        return NextResponse.json(logs);
    } catch (error) {
        console.error("Error in GET /api/workouts:", error);
        return NextResponse.json(
            { error: "Failed to fetch workout logs" },
            { status: 500 },
        );
    }
}

/**
 * POST /api/workouts
 * Create or update a workout log
 */
export async function POST(req: Request) {
    try {
        const body = (await req.json()) as Omit<WorkoutLog, "id"> & {
            id?: string;
        };

        // Validate required fields
        if (!body.date) {
            return NextResponse.json(
                { error: "Date is required" },
                { status: 400 },
            );
        }

        const newLog: WorkoutLog = {
            id: body.id || randomUUID(),
            content: body.content,
            weight: body.weight,
            photos: body.photos,
            date: body.date,
        };

        const id = await saveWorkoutLog(newLog);

        return NextResponse.json({ id });
    } catch (error) {
        console.error("Error in POST /api/workouts:", error);
        return NextResponse.json(
            { error: "Failed to save workout log" },
            { status: 500 },
        );
    }
}

/**
 * DELETE /api/workouts
 * Delete a workout log by ID
 * Query param: id
 */
export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                { error: "Log ID is required" },
                { status: 400 },
            );
        }

        await deleteWorkoutLog(id);

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Error in DELETE /api/workouts:", error);
        return NextResponse.json(
            { error: "Failed to delete workout log" },
            { status: 500 },
        );
    }
}

