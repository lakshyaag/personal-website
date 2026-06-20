import { NextResponse } from "next/server";
import { getGoogleBooksVolume, GoogleBooksError } from "@/lib/google-books";

export async function GET(
	_req: Request,
	{ params }: { params: Promise<{ id: string }> },
) {
	try {
		const { id } = await params;

		if (!id?.trim()) {
			return NextResponse.json(
				{ error: "Volume ID is required" },
				{ status: 400 },
			);
		}

		const data = await getGoogleBooksVolume(id.trim());
		return NextResponse.json(data);
	} catch (error) {
		if (error instanceof GoogleBooksError) {
			return NextResponse.json({ error: error.message }, { status: error.status });
		}

		console.error("Error in GET /api/books/volumes/[id]:", error);
		return NextResponse.json(
			{ error: "Failed to fetch book details" },
			{ status: 500 },
		);
	}
}
