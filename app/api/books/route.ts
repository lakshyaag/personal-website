import { NextResponse } from "next/server";
import { getBooks, saveBook, deleteBook } from "@/lib/books-db";
import type { BookEntry } from "@/lib/books";
import { randomUUID } from "crypto";

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

		const book: BookEntry = {
			id: body.id || randomUUID(),
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
			isCurrent: body.isCurrent ?? false,
		};

		const id = await saveBook(book);

		return NextResponse.json({ ok: true, id });
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

		await deleteBook(id);

		return NextResponse.json({ ok: true });
	} catch (error) {
		console.error("Error in DELETE /api/books:", error);
		return NextResponse.json(
			{ error: "Failed to delete book" },
			{ status: 500 },
		);
	}
}
