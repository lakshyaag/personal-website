export interface BookEntry {
	id: string;
	title: string;
	author: string;
	isbn?: string;
	coverUrl?: string;
	description?: string;
	categories?: string[];
	progress?: number; // 0-100, only for reading status
	status: "reading" | "completed" | "want-to-read";
	dateStarted: string;
	dateCompleted?: string;
	notes?: string;
	isCurrent?: boolean;
}

// Database row type (snake_case columns)
export interface BookDbRow {
	id: string;
	title: string;
	author: string;
	isbn: string | null;
	cover_url: string | null;
	description: string | null;
	categories: string[] | null;
	progress: number | null;
	status: "reading" | "completed" | "want-to-read";
	date_started: string;
	date_completed: string | null;
	notes: string | null;
	is_current: boolean;
	created_at: string;
	updated_at: string;
}

// Transform database row to application type
export function transformBookFromDb(row: BookDbRow): BookEntry {
	return {
		id: row.id,
		title: row.title,
		author: row.author,
		isbn: row.isbn ?? undefined,
		coverUrl: row.cover_url ?? undefined,
		description: row.description ?? undefined,
		categories: row.categories ?? undefined,
		progress: row.progress ?? undefined,
		status: row.status,
		dateStarted: row.date_started,
		dateCompleted: row.date_completed ?? undefined,
		notes: row.notes ?? undefined,
		isCurrent: row.is_current,
	};
}

// Transform application type to database row
export function transformBookToDb(
	entry: BookEntry
): Omit<BookDbRow, "created_at" | "updated_at"> {
	return {
		id: entry.id,
		title: entry.title,
		author: entry.author,
		isbn: entry.isbn ?? null,
		cover_url: entry.coverUrl ?? null,
		description: entry.description ?? null,
		categories: entry.categories ?? null,
		progress: entry.progress ?? null,
		status: entry.status,
		date_started: entry.dateStarted,
		date_completed: entry.dateCompleted ?? null,
		notes: entry.notes ?? null,
		is_current: entry.isCurrent ?? false,
	};
}
