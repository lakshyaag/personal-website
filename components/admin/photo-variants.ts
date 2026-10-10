import { type ExtractedMetadata, extractMetadata } from "@/shared/exif";
import { type PhotoVariant, variantSizes } from "@/shared/photos";

export interface PreparedPhoto {
	width: number;
	height: number;
	metadata: ExtractedMetadata;
	variants: Record<PhotoVariant, Blob>;
}
const quality: Record<PhotoVariant, number> = { display: 0.85, thumb: 0.78 };

async function encode(bitmap: ImageBitmap, max: number, q: number) {
	const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
	const width = Math.max(1, Math.round(bitmap.width * scale));
	const height = Math.max(1, Math.round(bitmap.height * scale));
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext("2d");
	if (!context) throw new Error("This browser cannot resize images");
	context.imageSmoothingQuality = "high";
	context.drawImage(bitmap, 0, 0, width, height);
	const blob = (type: string) =>
		new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, q));
	// Safari can't encode WebP and silently returns PNG; JPEG is the universal fallback.
	const webp = await blob("image/webp");
	if (webp?.type === "image/webp") return webp;
	const jpeg = await blob("image/jpeg");
	if (jpeg?.type === "image/jpeg") return jpeg;
	throw new Error("This browser cannot encode images");
}

/**
 * Resizes in the browser so the Worker never processes images. Canvas encoding writes no
 * EXIF, so GPS and camera data can't leak through variants; they're read here and stored
 * as private metadata instead.
 */
export async function preparePhoto(file: File): Promise<PreparedPhoto> {
	// Applies EXIF orientation, so variants are upright.
	const bitmap = await createImageBitmap(file).catch(() => {
		throw new Error("Couldn't read this image. Try a JPEG or PNG.");
	});
	try {
		if (bitmap.width * bitmap.height > 40_000_000)
			throw new Error("Image exceeds 40 megapixels");
		const [display, thumb, metadata] = await Promise.all([
			encode(bitmap, variantSizes.display, quality.display),
			encode(bitmap, variantSizes.thumb, quality.thumb),
			file
				.slice(0, 512 * 1024)
				.arrayBuffer()
				.then(extractMetadata),
		]);
		return {
			width: bitmap.width,
			height: bitmap.height,
			metadata,
			variants: { display, thumb },
		};
	} finally {
		bitmap.close();
	}
}
