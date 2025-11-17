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
