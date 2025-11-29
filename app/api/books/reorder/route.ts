import { NextResponse } from "next/server";
import { setCurrentBook } from "@/lib/books-db";

export async function POST(req: Request) {
	try {
		const { bookId } = (await req.json()) as { bookId: string };

		if (!bookId) {
			return NextResponse.json(
				{ error: "Missing book id" },
				{ status: 400 },
			);
		}

		await setCurrentBook(bookId);

		return NextResponse.json({ ok: true });
	} catch (error) {
		console.error("Error in POST /api/books/reorder:", error);
		return NextResponse.json(
			{ error: "Failed to set current book" },
			{ status: 500 },
		);
	}
}
