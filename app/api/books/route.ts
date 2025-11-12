import { NextResponse } from "next/server";
import { getBooks, saveBooks } from "@/lib/books-storage";
import type { BookEntry } from "@/lib/books";

export async function GET() {
	try {
		const books = await getBooks();
		return NextResponse.json(books);
	} catch (error) {
		console.error("Error in GET /api/books:", error);
		return NextResponse.json(
			{ error: "Failed to fetch books" },
			{ status: 500 },
		);
	}
}

export async function POST(req: Request) {
	try {
		const body = (await req.json()) as Omit<BookEntry, "id"> & { id?: string };

		const books = await getBooks();
		const existingIndex = books.findIndex((b) => b.id === body.id);
		const existingBook = existingIndex >= 0 ? books[existingIndex] : null;

		const book: BookEntry = {
			id: body.id || `book-${Date.now()}`,
			title: body.title,
			author: body.author,
			isbn: body.isbn,
			coverUrl: body.coverUrl,
			description: body.description,
			categories: body.categories,
			progress: Math.min(100, Math.max(0, body.progress || 0)),
			status: body.status || "reading",
			dateStarted: body.dateStarted,
			dateCompleted: body.dateCompleted,
			notes: body.notes,
			isCurrent: body.isCurrent !== undefined ? body.isCurrent : existingBook?.isCurrent,
		};

		// If updating existing book
		if (existingIndex >= 0) {
			books[existingIndex] = book;
		} else {
			// New book goes to top (becomes current)
			books.unshift(book);
		}

		await saveBooks(books);

		return NextResponse.json({ ok: true, id: book.id });
	} catch (error) {
		console.error("Error in POST /api/books:", error);
		return NextResponse.json(
			{ error: "Failed to save book" },
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
				{ error: "Missing book id" },
				{ status: 400 },
			);
		}

		const books = await getBooks();
		const filtered = books.filter((b) => b.id !== id);

		await saveBooks(filtered);

		return NextResponse.json({ ok: true });
	} catch (error) {
		console.error("Error in DELETE /api/books:", error);
		return NextResponse.json(
			{ error: "Failed to delete book" },
			{ status: 500 },
		);
	}
}
