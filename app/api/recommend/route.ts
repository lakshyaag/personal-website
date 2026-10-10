import { cloudflareAdmin } from "@/lib/backend/config";
import {
	publicRecommendations,
	submitRecommendation,
} from "@/lib/backend/public-data";
import type { Recommendation } from "@/lib/models";
import {
	deleteRecommendation,
	getRecommendations,
	saveRecommendation,
} from "@/lib/recommendations-db";
import { createRecommendationSchema } from "@/shared/books";
import { NextResponse } from "next/server";
import { z } from "zod";

export async function GET() {
	try {
		if (cloudflareAdmin())
			return NextResponse.json(await publicRecommendations());
		const recommendations = await getRecommendations();
		return NextResponse.json(recommendations);
	} catch (error) {
		console.error("Error fetching recommendations:", error);
		return NextResponse.json(
			{ error: "Failed to fetch recommendations" },
			{ status: 500 },
		);
	}
}

export async function POST(req: Request) {
	try {
		const body = await req.json();
		if (cloudflareAdmin()) {
			const parsed = createRecommendationSchema.safeParse(body);
			if (!parsed.success)
				return NextResponse.json(
					{ error: z.prettifyError(parsed.error) },
					{ status: 400 },
				);
			await submitRecommendation(parsed.data);
			return NextResponse.json({ success: true });
		}
		const {
			bookName,
			bookAuthor,
			bookCoverUrl,
			googleBooksId,
			recommenderName,
			comment,
		} = body;

		if (!bookName || typeof bookName !== "string") {
			return NextResponse.json(
				{ error: "Book name is required" },
				{ status: 400 },
			);
		}

		const recommendation: Omit<Recommendation, "id" | "timestamp"> = {
			bookName: bookName.trim(),
			bookAuthor: bookAuthor?.trim(),
			bookCoverUrl: bookCoverUrl?.trim(),
			googleBooksId: googleBooksId?.trim(),
			recommenderName: recommenderName?.trim(),
			comment: comment?.trim(),
		};

		await saveRecommendation(recommendation);

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error saving recommendation:", error);
		return NextResponse.json(
			{ error: "Failed to save recommendation" },
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
				{ error: "Recommendation ID is required" },
				{ status: 400 },
			);
		}

		await deleteRecommendation(id);

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error deleting recommendation:", error);
		return NextResponse.json(
			{ error: "Failed to delete recommendation" },
			{ status: 500 },
		);
	}
}
