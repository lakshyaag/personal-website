/**
 * Books API routes
 * Migrated to use consolidated API route builder
 */

import { createCrudRoutes } from "@/lib/api-route-builder";
import { getBooks, saveBook, deleteBook } from "@/lib/books-db";
import type { BookEntry } from "@/lib/models";

export const { GET, POST, DELETE } = createCrudRoutes<BookEntry>({
	dbOperations: {
		getAll: getBooks,
		save: saveBook,
		delete: deleteBook,
	},
	entityName: "book",
	requiredFields: ["title", "author"],
});
