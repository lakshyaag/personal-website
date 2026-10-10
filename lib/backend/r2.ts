import "server-only";
import {
	type Photo,
	type UploadPhotoInput,
	originalKey,
	variantKey,
} from "@/shared/photos";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { BackendError } from "./worker";

/** Presigned PUTs for the original and both browser-made variants. Size, type and no-overwrite are signed. */
export async function photoUploadUrls(photo: Photo, input: UploadPhotoInput) {
	const account = process.env.R2_ACCOUNT_ID;
	const accessKeyId = process.env.PRIVATE_R2_ACCESS_KEY_ID;
	const secretAccessKey = process.env.PRIVATE_R2_SECRET_ACCESS_KEY;
	const bucket = process.env.PRIVATE_R2_BUCKET;
	if (
		!account ||
		!accessKeyId ||
		!secretAccessKey ||
		!bucket ||
		[account, accessKeyId, secretAccessKey, bucket].some((v) =>
			/REPLACE|^<|placeholder/i.test(v),
		)
	)
		throw new BackendError(
			503,
			"Private R2 uploads are not configured",
			"CONFIGURATION",
		);
	// Separate bucket is mandatory: never reuse the public site-assets bucket.
	if (bucket === "site-assets" || bucket === process.env.R2_BUCKET)
		throw new BackendError(
			503,
			"Private uploads require a separate private R2 bucket",
			"CONFIGURATION",
		);
	const client = new S3Client({
		// No Body exists while presigning: the SDK's default CRC32 would describe an empty file.
		requestChecksumCalculation: "WHEN_REQUIRED",
		region: "auto",
		endpoint: `https://${account}.r2.cloudflarestorage.com`,
		credentials: { accessKeyId, secretAccessKey },
	});
	if (!photo.generation)
		throw new BackendError(409, "Photo is not accepting uploads", "CONFLICT");
	const files = {
		original: {
			key: originalKey(photo.id),
			type: photo.mimeType,
			size: photo.byteSize,
		},
		display: {
			key: variantKey(photo.id, photo.generation, "display"),
			...input.display,
		},
		thumb: {
			key: variantKey(photo.id, photo.generation, "thumb"),
			...input.thumb,
		},
	};
	const entries = await Promise.all(
		Object.entries(files).map(async ([name, file]) => [
			name,
			{
				url: await getSignedUrl(
					client,
					new PutObjectCommand({
						Bucket: bucket,
						Key: file.key,
						ContentType: file.type,
						ContentLength: file.size,
						IfNoneMatch: "*",
					}),
					{
						expiresIn: 300,
						signableHeaders: new Set(["content-type", "if-none-match"]),
					},
				),
				headers: { "Content-Type": file.type, "If-None-Match": "*" },
			},
		]),
	);
	return Object.fromEntries(entries) as Record<
		keyof typeof files,
		{ url: string; headers: Record<string, string> }
	>;
}
