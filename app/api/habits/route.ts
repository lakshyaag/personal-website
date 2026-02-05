import { createCrudHandlers } from "@/lib/api-helpers";
import {
	getAllHabits,
	getHabitById,
	saveHabit,
	deleteHabitById,
	getActiveHabits,
} from "@/lib/habits-db";
import { NextResponse } from "next/server";

const handlers = createCrudHandlers(
	{
		getAll: getAllHabits,
		getById: getHabitById,
		save: saveHabit,
		deleteById: deleteHabitById,
	},
	{
		entityName: "habit",
		requiredFields: ["name", "type"],
		supportsIdLookup: true,
	},
);

// Override GET to add ?active=true support
export async function GET(req: Request) {
	const { searchParams } = new URL(req.url);
	const activeOnly = searchParams.get("active");

	if (activeOnly === "true") {
		try {
			const habits = await getActiveHabits();
			return NextResponse.json(habits);
		} catch (error) {
			console.error("Error fetching active habits:", error);
			return NextResponse.json(
				{ error: "Failed to fetch habits" },
				{ status: 500 },
			);
		}
	}

	return handlers.GET(req);
}

export const POST = handlers.POST;
export const DELETE = handlers.DELETE;
