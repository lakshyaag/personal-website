import { submitRecommendation } from "@/lib/backend/public-data";
import { createRecommendationSchema } from "@/shared/books";
import { NextResponse } from "next/server";
import { z } from "zod";

/** Public form on the bookshelf. Recommendations are listed by the page itself. */
export async function POST(req: Request) {
	try {
		const parsed = createRecommendationSchema.safeParse(await req.json());
		if (!parsed.success)
			return NextResponse.json(
				{ error: z.prettifyError(parsed.error) },
				{ status: 400 },
			);
		await submitRecommendation(parsed.data);
		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Error saving recommendation:", error);
		return NextResponse.json(
			{ error: "Failed to save recommendation" },
			{ status: 500 },
		);
	}
}
