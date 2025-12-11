/**
 * Generic API route handlers factory
 * Creates consistent GET, POST, DELETE handlers for CRUD operations
 */

import { NextResponse } from "next/server";

interface DbOperations<T> {
	getAll: () => Promise<T[]>;
	getById?: (id: string) => Promise<T | null>;
	save: (item: T) => Promise<string>;
	deleteById: (id: string) => Promise<void>;
	getByDate?: (date: string) => Promise<T[]>;
	getGroupedByDate?: () => Promise<Record<string, T[]>>;
}

interface CrudHandlersConfig {
	/** Human-readable entity name for error messages (e.g., "journal entry") */
	entityName: string;
	/** Fields that are required in POST requests */
	requiredFields?: string[];
	/** Whether this endpoint supports ?date= filtering */
	supportsDateFilter?: boolean;
	/** Whether this endpoint supports ?grouped=true */
	supportsGrouped?: boolean;
	/** Whether this endpoint supports ?id= for single item fetch */
	supportsIdLookup?: boolean;
}

interface CrudHandlers {
	GET: (req: Request) => Promise<NextResponse>;
	POST: (req: Request) => Promise<NextResponse>;
	DELETE: (req: Request) => Promise<NextResponse>;
}

/**
 * Creates standardized GET, POST, DELETE handlers for a CRUD endpoint
 */
export function createCrudHandlers<T>(
	dbOps: DbOperations<T>,
	config: CrudHandlersConfig,
): CrudHandlers {
	const {
		entityName,
		requiredFields = [],
		supportsDateFilter = false,
		supportsGrouped = false,
		supportsIdLookup = true,
	} = config;

	async function GET(req: Request): Promise<NextResponse> {
		try {
			const { searchParams } = new URL(req.url);
			const date = searchParams.get("date");
			const grouped = searchParams.get("grouped");
			const id = searchParams.get("id");

			// Get by ID
			if (supportsIdLookup && id && dbOps.getById) {
				const item = await dbOps.getById(id);
				if (!item) {
					return NextResponse.json(
						{ error: `${capitalize(entityName)} not found` },
						{ status: 404 },
					);
				}
				return NextResponse.json(item);
			}

			// Get by date
			if (supportsDateFilter && date && dbOps.getByDate) {
				const items = await dbOps.getByDate(date);
				return NextResponse.json(items);
			}

			// Get grouped by date
			if (supportsGrouped && grouped === "true" && dbOps.getGroupedByDate) {
				const groupedItems = await dbOps.getGroupedByDate();
				return NextResponse.json(groupedItems);
			}

			// Get all
			const items = await dbOps.getAll();
			return NextResponse.json(items);
		} catch (error) {
			console.error(`Error in GET /api/${entityName}:`, error);
			return NextResponse.json(
				{ error: `Failed to fetch ${entityName}` },
				{ status: 500 },
			);
		}
	}

	async function POST(req: Request): Promise<NextResponse> {
		try {
			const item = (await req.json()) as T;

			// Validate required fields
			for (const field of requiredFields) {
				if (!(item as Record<string, unknown>)[field]) {
					return NextResponse.json(
						{ error: `${capitalize(field)} is required` },
						{ status: 400 },
					);
				}
			}

			const id = await dbOps.save(item);
			return NextResponse.json({ id });
		} catch (error) {
			console.error(`Error in POST /api/${entityName}:`, error);
			return NextResponse.json(
				{ error: `Failed to save ${entityName}` },
				{ status: 500 },
			);
		}
	}

	async function DELETE(req: Request): Promise<NextResponse> {
		try {
			const { searchParams } = new URL(req.url);
			const id = searchParams.get("id");

			if (!id) {
				return NextResponse.json(
					{ error: `${capitalize(entityName)} ID is required` },
					{ status: 400 },
				);
			}

			await dbOps.deleteById(id);
			return NextResponse.json({ success: true });
		} catch (error) {
			console.error(`Error in DELETE /api/${entityName}:`, error);
			return NextResponse.json(
				{ error: `Failed to delete ${entityName}` },
				{ status: 500 },
			);
		}
	}

	return { GET, POST, DELETE };
}

function capitalize(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

