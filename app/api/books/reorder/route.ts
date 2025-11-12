import { NextResponse } from "next/server";
import { getBooks, saveBooks } from "@/lib/books-storage";

export async function POST(req: Request) {
	try {
		const { bookId } = (await req.json()) as { bookId: string };

		if (!bookId) {
			return NextResponse.json(
				{ error: "Missing book id" },
				{ status: 400 },
			);
		}

		const books = await getBooks();
		const bookIndex = books.findIndex((b) => b.id === bookId);

		if (bookIndex === -1) {
			return NextResponse.json(
				{ error: "Book not found" },
				{ status: 404 },
			);
		}

		// Set this book as current and clear isCurrent from all others
		books.forEach((book) => {
			book.isCurrent = book.id === bookId;
		});

		await saveBooks(books);

		return NextResponse.json({ ok: true });
	} catch (error) {
		console.error("Error in POST /api/books/reorder:", error);
		return NextResponse.json(
			{ error: "Failed to set current book" },
			{ status: 500 },
		);
	}
}
