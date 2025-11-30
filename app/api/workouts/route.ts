import { NextResponse } from "next/server";
import {
    getWorkoutLogs,
    saveWorkoutLog,
    deleteWorkoutLog,
} from "@/lib/workouts-db";
import type { WorkoutLog } from "@/lib/models";
import { randomUUID } from "node:crypto";

export async function GET() {
    try {
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

export async function POST(req: Request) {
    try {
        const body = (await req.json()) as Omit<WorkoutLog, "id"> & {
            id?: string;
        };

        const newLog: WorkoutLog = {
            id: body.id || randomUUID(),
            content: body.content,
            weight: body.weight,
            photos: body.photos,
            date: body.date,
        };

        const id = await saveWorkoutLog(newLog);

        return NextResponse.json({ ok: true, id });
    } catch (error) {
        console.error("Error in POST /api/workouts:", error);
        return NextResponse.json(
            { error: "Failed to save workout log" },
            { status: 500 },
        );
    }
}

export async function DELETE(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const id = searchParams.get("id");

        if (!id) {
            return NextResponse.json(
                { error: "Missing log id" },
                { status: 400 },
            );
        }

        await deleteWorkoutLog(id);

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("Error in DELETE /api/workouts:", error);
        return NextResponse.json(
            { error: "Failed to delete workout log" },
            { status: 500 },
        );
    }
}

