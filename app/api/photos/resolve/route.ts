import { NextResponse } from "next/server";
import {
	resolvePhotoAssetsByDisplayRefs,
	type ResolvedPhotoAsset,
} from "@/lib/photo-assets-db";

const MAX_REFS = 200;

export async function POST(req: Request) {
	try {
		const body = (await req.json()) as { refs?: unknown };
		const refs = Array.isArray(body.refs)
			? body.refs.filter(
					(ref): ref is string => typeof ref === "string" && ref.length > 0,
				)
			: [];

		if (refs.length === 0) {
			return NextResponse.json({
				photos: {} as Record<string, ResolvedPhotoAsset>,
			});
		}
		if (refs.length > MAX_REFS) {
			return NextResponse.json(
				{ error: `Too many refs (max ${MAX_REFS})` },
				{ status: 400 },
			);
		}

		const resolved = await resolvePhotoAssetsByDisplayRefs(refs);
		return NextResponse.json({
			photos: Object.fromEntries(resolved) as Record<string, ResolvedPhotoAsset>,
		});
	} catch (error) {
		console.error("Error in POST /api/photos/resolve:", error);
		return NextResponse.json(
			{ error: "Failed to resolve photos" },
			{ status: 500 },
		);
	}
}
