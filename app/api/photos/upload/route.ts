import {
	MAX_PHOTO_UPLOAD_BYTES,
	createPhotoUploadTarget,
	finalizePhotoUpload,
} from "@/lib/photo-upload-pipeline";
import type { UploadFolder } from "@/lib/photos";
import { createServerSupabaseClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

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

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function isPhotoId(value: string): boolean {
	return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
		value,
	);
}

function invalidRequest(error: string, status = 400) {
	return NextResponse.json({ error }, { status });
}

export async function POST(req: Request) {
	try {
		const supabase = await createServerSupabaseClient();
		const {
			data: { user },
			error: authError,
		} = await supabase.auth.getUser();
		if (authError || !user) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const payload = (await req.json().catch(() => null)) as unknown;
		if (!isRecord(payload)) {
			return invalidRequest("Invalid upload request");
		}

		const folderValue = payload.folder;
		const identifierValue = payload.identifier;
		if (typeof folderValue !== "string" || !isUploadFolder(folderValue)) {
			return invalidRequest("Invalid upload folder");
		}
		if (typeof identifierValue !== "string" || !identifierValue.trim()) {
			return invalidRequest("Missing upload identifier");
		}

		if (payload.action === "prepare") {
			const { fileName, fileSize, fileType } = payload;
			if (typeof fileName !== "string" || !fileName.trim()) {
				return invalidRequest("Missing file name");
			}
			if (
				typeof fileSize !== "number" ||
				!Number.isFinite(fileSize) ||
				fileSize <= 0
			) {
				return invalidRequest("Invalid file size");
			}
			if (fileSize > MAX_PHOTO_UPLOAD_BYTES) {
				return invalidRequest(
					`Photo must be smaller than ${MAX_PHOTO_UPLOAD_BYTES / 1024 / 1024} MB`,
					413,
				);
			}
			if (
				typeof fileType !== "string" ||
				(fileType !== "" && !fileType.startsWith("image/"))
			) {
				return invalidRequest("Only image uploads are supported");
			}

			const target = await createPhotoUploadTarget({
				fileName,
				folder: folderValue,
				identifier: identifierValue,
			});
			return NextResponse.json(target);
		}

		if (payload.action === "finalize") {
			const { photoId, originalPath } = payload;
			if (typeof photoId !== "string" || !isPhotoId(photoId)) {
				return invalidRequest("Invalid photo ID");
			}
			if (typeof originalPath !== "string" || !originalPath.trim()) {
				return invalidRequest("Missing original photo path");
			}

			const result = await finalizePhotoUpload({
				photoId,
				originalPath,
				folder: folderValue,
				identifier: identifierValue,
			});
			return NextResponse.json(result);
		}

		return invalidRequest("Invalid upload action");
	} catch (error) {
		console.error("Unified photo upload failed:", error);
		return NextResponse.json({ error: "Upload failed" }, { status: 500 });
	}
}
