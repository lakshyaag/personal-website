/**
 * API Route Builder for admin CRUD operations
 * Consolidates API route logic across all admin modules
 */

import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";

/**
 * Database operations interface
 */
export interface DbOperations<T extends { id: string }> {
	/** Get all items */
	getAll: () => Promise<T[]>;
	/** Get item by ID (optional) */
	getById?: (id: string) => Promise<T | null>;
	/** Get items by date (optional, for date-based entries) */
	getByDate?: (date: string) => Promise<T[]>;
	/** Get items grouped by date (optional) */
	getGrouped?: () => Promise<Record<string, T[]>>;
	/** Save (create or update) an item */
	save: (item: T) => Promise<string>;
	/** Delete an item by ID */
	delete: (id: string) => Promise<void>;
}

/**
 * Configuration for CRUD route builder
 */
export interface CrudRouteConfig<T extends { id: string }> {
	/** Database operations */
	dbOperations: DbOperations<T>;
	/** Entity name for error messages (e.g., "workout log") */
	entityName: string;
	/** Required fields for POST validation */
	requiredFields?: Array<keyof T>;
	/** Custom validation function */
	validate?: (item: T) => string | null;
	/** Generate ID if not provided (default: randomUUID) */
	generateId?: () => string;
}

/**
 * Create CRUD route handlers
 */
export function createCrudRoutes<T extends { id: string }>(
	config: CrudRouteConfig<T>
) {
	const {
		dbOperations,
		entityName,
		requiredFields = [],
		validate,
		generateId = randomUUID,
	} = config;

	/**
	 * GET handler
	 * Supports query params:
	 * - id: Get single item by ID
	 * - date: Get items for specific date (if getByDate provided)
	 * - grouped: Get items grouped by date (if getGrouped provided)
	 */
	async function GET(req: Request) {
		try {
			const { searchParams } = new URL(req.url);
			const id = searchParams.get("id");
			const date = searchParams.get("date");
			const grouped = searchParams.get("grouped");

			// Get by ID
			if (id && dbOperations.getById) {
				const item = await dbOperations.getById(id);
				if (!item) {
					return NextResponse.json(
						{ error: `${entityName} not found` },
						{ status: 404 }
					);
				}
				return NextResponse.json(item);
			}

			// Get by date
			if (date && dbOperations.getByDate) {
				const items = await dbOperations.getByDate(date);
				return NextResponse.json(items);
			}

			// Get grouped
			if (grouped === "true" && dbOperations.getGrouped) {
				const groupedItems = await dbOperations.getGrouped();
				return NextResponse.json(groupedItems);
			}

			// Get all
			const items = await dbOperations.getAll();
			return NextResponse.json(items);
		} catch (error) {
			console.error(`Error in GET ${entityName}:`, error);
			return NextResponse.json(
				{ error: `Failed to fetch ${entityName}` },
				{ status: 500 }
			);
		}
	}

	/**
	 * POST handler
	 * Creates or updates an item
	 */
	async function POST(req: Request) {
		try {
			const body = (await req.json()) as Partial<T> & { id?: string };

			// Validate required fields
			for (const field of requiredFields) {
				if (!body[field]) {
					return NextResponse.json(
						{ error: `${String(field)} is required` },
						{ status: 400 }
					);
				}
			}

			// Ensure ID
			const item = {
				...body,
				id: body.id || generateId(),
			} as T;

			// Custom validation
			if (validate) {
				const validationError = validate(item);
				if (validationError) {
					return NextResponse.json({ error: validationError }, { status: 400 });
				}
			}

			// Save
			const id = await dbOperations.save(item);

			return NextResponse.json({ id });
		} catch (error) {
			console.error(`Error in POST ${entityName}:`, error);
			return NextResponse.json(
				{ error: `Failed to save ${entityName}` },
				{ status: 500 }
			);
		}
	}

	/**
	 * DELETE handler
	 * Deletes an item by ID
	 */
	async function DELETE(req: Request) {
		try {
			const { searchParams } = new URL(req.url);
			const id = searchParams.get("id");

			if (!id) {
				return NextResponse.json(
					{ error: "ID is required" },
					{ status: 400 }
				);
			}

			await dbOperations.delete(id);

			return NextResponse.json({ success: true });
		} catch (error) {
			console.error(`Error in DELETE ${entityName}:`, error);
			return NextResponse.json(
				{ error: `Failed to delete ${entityName}` },
				{ status: 500 }
			);
		}
	}

	return { GET, POST, DELETE };
}
