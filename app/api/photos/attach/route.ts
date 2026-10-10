import { attachPhotoAsset } from "@/lib/photo-assets-db";
import {
	type PhotoContextType,
	type UploadFolder,
	contextTypeForFolder,
} from "@/lib/photos";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

const CONTEXT_TYPES = new Set<PhotoContextType>([
	"airport_visit",
	"journal",
	"food",
	"workout",
	"fit",
	"gallery",
]);

function isContextType(value: string): value is PhotoContextType {
	return CONTEXT_TYPES.has(value as PhotoContextType);
}

function isUploadFolder(value: string): value is UploadFolder {
	return (
		value === "airports" ||
		value === "journal" ||
		value === "food" ||
		value === "workouts" ||
		value === "fits" ||
		value === "gallery"
	);
}

export async function POST(req: Request) {
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
			photoIds?: string[];
			contextType?: string;
			contextId?: string;
			folder?: string;
		};

		const photoIds = Array.isArray(body.photoIds)
			? body.photoIds.filter(
					(id): id is string => typeof id === "string" && id.length > 0,
				)
			: [];
		if (photoIds.length === 0) {
			return NextResponse.json({ error: "Missing photoIds" }, { status: 400 });
		}

		const contextId =
			typeof body.contextId === "string" ? body.contextId.trim() : "";
		if (!contextId) {
			return NextResponse.json({ error: "Missing contextId" }, { status: 400 });
		}

		let contextType: PhotoContextType | null = null;
		if (
			typeof body.contextType === "string" &&
			isContextType(body.contextType)
		) {
			contextType = body.contextType;
		} else if (typeof body.folder === "string" && isUploadFolder(body.folder)) {
			contextType = contextTypeForFolder(body.folder);
		}

		if (!contextType) {
			return NextResponse.json(
				{ error: "Invalid contextType" },
				{ status: 400 },
			);
		}

		const refs: string[] = [];
		for (const photoId of photoIds) {
			const attached = await attachPhotoAsset({
				photoId,
				contextType,
				contextId,
			});
			refs.push(attached.displayRef);
		}

		return NextResponse.json({ ok: true, photoRefs: refs });
	} catch (error) {
		console.error("Error in POST /api/photos/attach:", error);
		return NextResponse.json(
			{
				error:
					error instanceof Error ? error.message : "Failed to attach photos",
			},
			{ status: 500 },
		);
	}
}
