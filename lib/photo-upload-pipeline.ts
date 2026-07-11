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
	photoId: string;
	originalPath: string;
	folder: UploadFolder;
	identifier: string;
}

interface CreatePhotoUploadTargetParams {
	fileName: string;
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

export interface PhotoUploadTarget {
	photoId: string;
	originalPath: string;
	token: string;
}

export const MAX_PHOTO_UPLOAD_BYTES = 50 * 1024 * 1024;

const ORIGINALS_BUCKET = "photo-originals";

function sanitizeIdentifier(identifier: string): string {
	return identifier.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 120);
}

function extensionFromFile(fileName: string): string {
	const parts = fileName.split(".");
	if (parts.length < 2) return "jpg";
	const extension = parts[parts.length - 1]
		?.toLowerCase()
		.replace(/[^a-z0-9]/g, "")
		.slice(0, 10);
	return extension || "jpg";
}

interface ParsedPhotoExif {
	DateTimeOriginal?: Date;
	CreateDate?: Date;
	Make?: string;
	Model?: string;
	LensModel?: string;
	FNumber?: number;
	ExposureTime?: number;
	ISO?: number;
	latitude?: number;
	longitude?: number;
	GPSLatitude?: number;
	GPSLongitude?: number;
	GPSLatitudeRef?: string;
	GPSLongitudeRef?: string;
	GPSAltitude?: number;
}

function toSafeExif(exif: ParsedPhotoExif | null | undefined) {
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

function gpsCoordinate(value: number | undefined, ref: string | undefined) {
	if (value === undefined) return null;
	return ref === "S" || ref === "W" ? -value : value;
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

export async function createPhotoUploadTarget(
	params: CreatePhotoUploadTargetParams,
): Promise<PhotoUploadTarget> {
	const { fileName, folder, identifier } = params;
	const normalizedIdentifier = sanitizeIdentifier(identifier);
	if (!normalizedIdentifier) {
		throw new Error("Missing valid identifier for upload");
	}

	const photoId = randomUUID();
	const sourceExt = extensionFromFile(fileName);
	const basePath = `${folder}/${normalizedIdentifier}/${Date.now()}-${photoId}`;
	const originalPath = `${basePath}/original.${sourceExt}`;
	const { data, error } = await supabaseAdmin.storage
		.from(ORIGINALS_BUCKET)
		.createSignedUploadUrl(originalPath);

	if (error || !data?.token) {
		throw new Error(
			`Failed to create signed photo upload: ${error?.message ?? "Missing upload token"}`,
		);
	}

	return {
		photoId,
		originalPath,
		token: data.token,
	};
}

export async function finalizePhotoUpload(
	params: UploadPhotoParams,
): Promise<UploadPhotoResult> {
	const { photoId, originalPath, folder, identifier } = params;
	const normalizedIdentifier = sanitizeIdentifier(identifier);
	if (!normalizedIdentifier) {
		throw new Error("Missing valid identifier for upload");
	}

	const pathPrefix = `${folder}/${normalizedIdentifier}/`;
	const originalFileSegment = "/original.";
	const originalFileIndex = originalPath.lastIndexOf(originalFileSegment);
	const basePath =
		originalFileIndex === -1 ? "" : originalPath.slice(0, originalFileIndex);
	const baseName = basePath.slice(pathPrefix.length);
	const originalExtension =
		originalFileIndex === -1
			? ""
			: originalPath.slice(originalFileIndex + originalFileSegment.length);
	const timestamp = baseName.slice(0, -(photoId.length + 1));

	if (
		!originalPath.startsWith(pathPrefix) ||
		!baseName.endsWith(`-${photoId}`) ||
		!/^\d{13}$/.test(timestamp) ||
		!/^[a-z0-9]{1,10}$/.test(originalExtension)
	) {
		throw new Error("Invalid original photo path");
	}

	const originalFileName = `original.${originalExtension}`;
	const { data: originalObjects, error: listError } =
		await supabaseAdmin.storage.from(ORIGINALS_BUCKET).list(basePath, {
			limit: 10,
			search: originalFileName,
		});
	const originalObject = originalObjects?.find(
		(object) => object.name === originalFileName,
	);
	if (listError || !originalObject) {
		throw new Error(
			`Failed to find original photo: ${listError?.message ?? "Missing file"}`,
		);
	}

	const originalSize = Number(originalObject.metadata?.size);
	if (Number.isFinite(originalSize) && originalSize > MAX_PHOTO_UPLOAD_BYTES) {
		throw new Error("Photo exceeds the maximum upload size");
	}

	const { data: originalBlob, error: downloadError } =
		await supabaseAdmin.storage.from(ORIGINALS_BUCKET).download(originalPath);
	if (downloadError || !originalBlob) {
		throw new Error(
			`Failed to download original photo: ${downloadError?.message ?? "Missing file"}`,
		);
	}

	const fileBuffer = Buffer.from(await originalBlob.arrayBuffer());
	if (fileBuffer.byteLength > MAX_PHOTO_UPLOAD_BYTES) {
		throw new Error("Photo exceeds the maximum upload size");
	}
	const image = sharp(fileBuffer, { failOn: "none" }).rotate();
	const metadata = await image.metadata();

	const exif = (await parseExif(fileBuffer, {
		gps: true,
		pick: [
			"DateTimeOriginal",
			"CreateDate",
			"Make",
			"Model",
			"LensModel",
			"FNumber",
			"ExposureTime",
			"ISO",
			"GPSLatitude",
			"GPSLongitude",
			"GPSLatitudeRef",
			"GPSLongitudeRef",
			"GPSAltitude",
			"latitude",
			"longitude",
		],
		reviveValues: true,
	}).catch(() => null)) as ParsedPhotoExif | null;

	const visibility = visibilityForFolder(folder);
	const contextType = contextTypeForFolder(folder);

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
	const gpsLatitude =
		exif?.latitude ?? gpsCoordinate(exif?.GPSLatitude, exif?.GPSLatitudeRef);
	const gpsLongitude =
		exif?.longitude ?? gpsCoordinate(exif?.GPSLongitude, exif?.GPSLongitudeRef);
	const gpsAltitude = exif?.GPSAltitude ?? null;

	const { error: assetError } = await supabaseAdmin.from("photo_assets").insert({
		id: photoId,
		original_private_ref: encodeSupabaseRef(ORIGINALS_BUCKET, originalPath),
		width: metadata.width ?? null,
		height: metadata.height ?? null,
		taken_at: takenAt,
		safe_exif: safeExif,
		gps_latitude: gpsLatitude,
		gps_longitude: gpsLongitude,
		gps_altitude: gpsAltitude,
		gps_public: false,
		visibility,
		gallery_featured: false,
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
