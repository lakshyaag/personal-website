import { NextResponse } from "next/server";
import { GoogleBooksError, searchGoogleBooks } from "@/lib/google-books";

export async function GET(req: Request) {
	try {
		const { searchParams } = new URL(req.url);
		const query = searchParams.get("q")?.trim();

		if (!query) {
			return NextResponse.json({ error: "Query is required" }, { status: 400 });
		}

		const maxResults = Math.min(
			40,
			Math.max(1, Number.parseInt(searchParams.get("maxResults") || "10", 10)),
		);

		const data = await searchGoogleBooks(query, maxResults);
		return NextResponse.json(data);
	} catch (error) {
		if (error instanceof GoogleBooksError) {
			return NextResponse.json({ error: error.message }, { status: error.status });
		}

		console.error("Error in GET /api/books/search:", error);
		return NextResponse.json(
			{ error: "Failed to search books" },
			{ status: 500 },
		);
	}
}
