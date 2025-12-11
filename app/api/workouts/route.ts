import { createCrudHandlers } from "@/lib/api-helpers";
import {
	getWorkoutLogs,
	saveWorkoutLog,
	deleteWorkoutLog,
	getWorkoutLogsByDate,
	getWorkoutLogsGroupedByDate,
} from "@/lib/workouts-db";
import type { WorkoutLog } from "@/lib/models";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

// Use the generic handler for GET and DELETE
const crudHandlers = createCrudHandlers(
	{
		getAll: getWorkoutLogs,
		save: saveWorkoutLog,
		deleteById: deleteWorkoutLog,
		getByDate: getWorkoutLogsByDate,
		getGroupedByDate: getWorkoutLogsGroupedByDate,
	},
	{
		entityName: "workout log",
		supportsDateFilter: true,
		supportsGrouped: true,
		supportsIdLookup: false,
	},
);

export const GET = crudHandlers.GET;
export const DELETE = crudHandlers.DELETE;

// Custom POST handler to handle ID generation
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
