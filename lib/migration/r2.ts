import "server-only";
import { type JournalPhoto, originalKey } from "@/shared/journal";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { BackendError } from "./worker-client";

export async function photoUploadUrl(photo: JournalPhoto) {
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
	return getSignedUrl(
		client,
		new PutObjectCommand({
			Bucket: bucket,
			Key: originalKey(photo.id),
			ContentType: photo.mimeType,
			ContentLength: photo.byteSize,
			IfNoneMatch: "*",
		}),
		{
			expiresIn: 300,
			signableHeaders: new Set(["content-type", "if-none-match"]),
		},
	);
}
