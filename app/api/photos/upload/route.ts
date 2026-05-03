import { NextResponse } from "next/server";
import { uploadPhotoWithUnifiedPipeline } from "@/lib/photo-upload-pipeline";
import type { UploadFolder } from "@/lib/photos";
import { createServerSupabaseClient } from "@/lib/supabase-server";

export const runtime = "nodejs";

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
			error: authError,
		} = await supabase.auth.getSession();
		if (authError || !session) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const form = await req.formData();
		const file = form.get("file");
		const folderValue = form.get("folder");
		const identifierValue = form.get("identifier");

		if (!(file instanceof File)) {
			return NextResponse.json(
				{ error: "Missing upload file" },
				{ status: 400 },
			);
		}
		if (typeof folderValue !== "string" || !isUploadFolder(folderValue)) {
			return NextResponse.json(
				{ error: "Invalid upload folder" },
				{ status: 400 },
			);
		}
		if (typeof identifierValue !== "string" || !identifierValue.trim()) {
			return NextResponse.json(
				{ error: "Missing upload identifier" },
				{ status: 400 },
			);
		}

		const result = await uploadPhotoWithUnifiedPipeline({
			file,
			folder: folderValue,
			identifier: identifierValue,
		});

		return NextResponse.json(result);
	} catch (error) {
		console.error("Unified photo upload failed:", error);
		return NextResponse.json(
			{ error: "Upload failed" },
			{ status: 500 },
		);
	}
}
