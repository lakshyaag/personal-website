import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { parse as parseExif } from "exifr";
import { supabaseAdmin } from "./supabase-client";
import {
	contextTypeForFolder,
	derivePreferredPhotoRef,
	type PhotoVisibility,
	visibilityForFolder,
	type UploadFolder,
} from "./photos";
import { encodeSupabaseRef } from "./photo-refs";

interface UploadPhotoParams {
	file: File;
	folder: UploadFolder;
	identifier: string;
}

interface StoredDerivative {
	kind: "thumb" | "full" | "private_full";
	bucket: string;
	path: string;
	width: number | null;
	height: number | null;
	bytes: number;
	format: string;
}

export interface UploadPhotoResult {
	photoId: string;
	photoRef: string;
	visibility: PhotoVisibility;
}

function sanitizeIdentifier(identifier: string): string {
	return identifier.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 120);
}

function extensionFromFile(fileName: string): string {
	const parts = fileName.split(".");
	if (parts.length < 2) return "jpg";
	return parts[parts.length - 1]?.toLowerCase() || "jpg";
}

function toSafeExif(
	exif:
		| {
				Make?: string;
				Model?: string;
				LensModel?: string;
				FNumber?: number;
				ExposureTime?: number;
				ISO?: number;
		  }
		| null
		| undefined,
) {
	if (!exif) return {};
	return {
		make: exif.Make ?? null,
		model: exif.Model ?? null,
		lensModel: exif.LensModel ?? null,
		fNumber: exif.FNumber ?? null,
		exposureTime: exif.ExposureTime ?? null,
		iso: exif.ISO ?? null,
	};
}

async function uploadObject(
	bucket: string,
	path: string,
	buffer: Buffer,
	contentType: string,
) {
	const { error } = await supabaseAdmin.storage.from(bucket).upload(path, buffer, {
		contentType,
		upsert: false,
	});
	if (error) {
		throw new Error(`Upload failed for ${bucket}/${path}: ${error.message}`);
	}
}

export async function uploadPhotoWithUnifiedPipeline(
	params: UploadPhotoParams,
): Promise<UploadPhotoResult> {
	const { file, folder, identifier } = params;
	const normalizedIdentifier = sanitizeIdentifier(identifier);
	if (!normalizedIdentifier) {
		throw new Error("Missing valid identifier for upload");
	}

	const photoId = randomUUID();
	const now = Date.now();
	const sourceExt = extensionFromFile(file.name);
	const basePath = `${folder}/${normalizedIdentifier}/${now}-${photoId}`;

	const fileBuffer = Buffer.from(await file.arrayBuffer());
	const image = sharp(fileBuffer, { failOn: "none" }).rotate();
	const metadata = await image.metadata();

	const exif = await parseExif(fileBuffer, {
		pick: ["DateTimeOriginal", "CreateDate", "Make", "Model", "LensModel", "FNumber", "ExposureTime", "ISO"],
		reviveValues: true,
	}).catch(() => null);

	const visibility = visibilityForFolder(folder);
	const contextType = contextTypeForFolder(folder);

	const originalPath = `${basePath}/original.${sourceExt}`;
	await uploadObject("photo-originals", originalPath, fileBuffer, file.type || "application/octet-stream");

	const fullBuffer = await image
		.clone()
		.resize({ width: 2048, height: 2048, fit: "inside", withoutEnlargement: true })
		.jpeg({ quality: 84, mozjpeg: true })
		.toBuffer();
	const fullMeta = await sharp(fullBuffer).metadata();

	const thumbBuffer = await image
		.clone()
		.resize({ width: 480, height: 480, fit: "inside", withoutEnlargement: true })
		.jpeg({ quality: 78, mozjpeg: true })
		.toBuffer();
	const thumbMeta = await sharp(thumbBuffer).metadata();

	const privateDisplayPath = `${basePath}/private-full.jpg`;
	const publicDisplayPath = `${basePath}/public-full.jpg`;
	const thumbPath = `${basePath}/thumb.jpg`;

	const derivatives: StoredDerivative[] = [];

	await uploadObject("photo-private-display", privateDisplayPath, fullBuffer, "image/jpeg");
	derivatives.push({
		kind: "private_full",
		bucket: "photo-private-display",
		path: privateDisplayPath,
		width: fullMeta.width ?? null,
		height: fullMeta.height ?? null,
		bytes: fullBuffer.byteLength,
		format: "jpeg",
	});

	await uploadObject("photo-private-display", thumbPath, thumbBuffer, "image/jpeg");
	derivatives.push({
		kind: "thumb",
		bucket: "photo-private-display",
		path: thumbPath,
		width: thumbMeta.width ?? null,
		height: thumbMeta.height ?? null,
		bytes: thumbBuffer.byteLength,
		format: "jpeg",
	});

	if (visibility === "public") {
		await uploadObject("photo-public", publicDisplayPath, fullBuffer, "image/jpeg");
		derivatives.push({
			kind: "full",
			bucket: "photo-public",
			path: publicDisplayPath,
			width: fullMeta.width ?? null,
			height: fullMeta.height ?? null,
			bytes: fullBuffer.byteLength,
			format: "jpeg",
		});
	}

	const safeExif = toSafeExif(exif);
	const takenAtRaw = exif?.DateTimeOriginal ?? exif?.CreateDate ?? null;
	const takenAt =
		takenAtRaw instanceof Date ? takenAtRaw.toISOString() : null;

	const { error: assetError } = await supabaseAdmin.from("photo_assets").insert({
		id: photoId,
		original_private_ref: encodeSupabaseRef("photo-originals", originalPath),
		width: metadata.width ?? null,
		height: metadata.height ?? null,
		taken_at: takenAt,
		safe_exif: safeExif,
		visibility,
		gallery_featured: contextType === "gallery",
	});
	if (assetError) {
		throw new Error(`Failed to save photo asset: ${assetError.message}`);
	}

	const { error: derivativeError } = await supabaseAdmin
		.from("photo_derivatives")
		.insert(
			derivatives.map((derivative) => ({
				id: randomUUID(),
				photo_id: photoId,
				kind: derivative.kind,
				bucket: derivative.bucket,
				path: derivative.path,
				width: derivative.width,
				height: derivative.height,
				bytes: derivative.bytes,
				format: derivative.format,
			})),
		);
	if (derivativeError) {
		throw new Error(`Failed to save photo derivatives: ${derivativeError.message}`);
	}

	const { error: attachmentError } = await supabaseAdmin
		.from("photo_attachments")
		.insert({
			photo_id: photoId,
			context_type: contextType,
			context_id: normalizedIdentifier,
			sort_order: 0,
		});
	if (attachmentError) {
		throw new Error(`Failed to save photo attachment: ${attachmentError.message}`);
	}

	const photoRef = derivePreferredPhotoRef(visibility, {
		publicPath: visibility === "public" ? publicDisplayPath : undefined,
		privatePath: privateDisplayPath,
	});

	return {
		photoId,
		photoRef,
		visibility,
	};
}
