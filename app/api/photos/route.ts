import { NextResponse } from "next/server";
import {
	listPhotoAssets,
	updatePhotoAssetVisibility,
} from "@/lib/photo-assets-db";
import type { PhotoVisibility } from "@/lib/photos";
import { createServerSupabaseClient } from "@/lib/supabase-server";

function isVisibility(value: string): value is PhotoVisibility {
	return value === "private" || value === "unlisted" || value === "public";
}

export async function GET(req: Request) {
	try {
		const { searchParams } = new URL(req.url);
		const admin = searchParams.get("admin") === "true";

		if (admin) {
			const supabase = await createServerSupabaseClient();
			const {
				data: { session },
				error,
			} = await supabase.auth.getSession();
			if (error || !session) {
				return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
			}
		}

		const photos = await listPhotoAssets({ admin });
		return NextResponse.json(photos);
	} catch (error) {
		console.error("Error in GET /api/photos:", error);
		return NextResponse.json(
			{ error: "Failed to load photos" },
			{ status: 500 },
		);
	}
}

export async function PATCH(req: Request) {
	try {
		const supabase = await createServerSupabaseClient();
		const {
			data: { session },
			error,
		} = await supabase.auth.getSession();
		if (error || !session) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const body = (await req.json()) as {
			id?: string;
			visibility?: string;
			galleryFeatured?: boolean;
		};

		if (!body.id || !body.visibility || !isVisibility(body.visibility)) {
			return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
		}

		await updatePhotoAssetVisibility({
			id: body.id,
			visibility: body.visibility,
			galleryFeatured: Boolean(body.galleryFeatured),
		});

		return NextResponse.json({ ok: true });
	} catch (error) {
		console.error("Error in PATCH /api/photos:", error);
		return NextResponse.json(
			{ error: "Failed to update photo" },
			{ status: 500 },
		);
	}
}
