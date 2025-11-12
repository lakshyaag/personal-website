import { put } from "@vercel/blob";
import type { BookEntry } from "./books";

const BOOKS_KEY = "books/library.json";

function getBooksUrl(): string {
	const token = process.env.BLOB_READ_WRITE_TOKEN;
	if (!token) throw new Error("BLOB_READ_WRITE_TOKEN not configured");

	const parts = token.split("_");
	const storeId = parts[3];

	return `https://${storeId}.public.blob.vercel-storage.com/${BOOKS_KEY}`;
}

export async function getBooks(): Promise<BookEntry[]> {
	try {
		const url = getBooksUrl();
		const res = await fetch(url, { cache: "no-store" });

		if (res.status === 404) {
			return [];
		}

		if (!res.ok) {
			throw new Error(`HTTP ${res.status}: ${res.statusText}`);
		}

		return await res.json();
	} catch (error) {
		console.error("Error fetching books:", error);
		return [];
	}
}

export async function saveBooks(books: BookEntry[]): Promise<void> {
	await put(BOOKS_KEY, JSON.stringify(books), {
		access: "public",
		allowOverwrite: true,
		contentType: "application/json",
	});
}
