import { createCrudHandlers } from "@/lib/api-helpers";
import {
	getAllCompletions,
	getCompletionById,
	saveCompletion,
	deleteCompletionById,
	getCompletionsByDate,
	getCompletionForHabitOnDate,
} from "@/lib/habits-db";
import { NextResponse } from "next/server";

const handlers = createCrudHandlers(
	{
		getAll: getAllCompletions,
		getById: getCompletionById,
		save: saveCompletion,
		deleteById: deleteCompletionById,
		getByDate: getCompletionsByDate,
	},
	{
		entityName: "habit completion",
		requiredFields: ["habitId", "date"],
		supportsDateFilter: true,
		supportsIdLookup: true,
	},
);

// Override GET to support ?habitId=xxx&date=xxx
export async function GET(req: Request) {
	const { searchParams } = new URL(req.url);
	const habitId = searchParams.get("habitId");
	const date = searchParams.get("date");

	// Get specific completion for habit+date
	if (habitId && date) {
		try {
			const completion = await getCompletionForHabitOnDate(habitId, date);
			return NextResponse.json(completion);
		} catch (error) {
			console.error("Error fetching completion:", error);
			return NextResponse.json(
				{ error: "Failed to fetch completion" },
				{ status: 500 },
			);
		}
	}

	return handlers.GET(req);
}

export const POST = handlers.POST;
export const DELETE = handlers.DELETE;
