import type { PhotoViewerItem } from "@/components/photos/PhotoLightbox";
import type { ResolvedPhotoAsset } from "@/lib/photo-assets-db";
import type { ReactNode } from "react";

export function formatPhotoDate(
	value: string | null | undefined,
	options?: Intl.DateTimeFormatOptions,
): string | null {
	if (!value) return null;
	return new Date(value).toLocaleDateString(
		"en-US",
		options ?? {
			month: "long",
			day: "numeric",
			year: "numeric",
		},
	);
}

export function formatPhotoDimensions(
	width: number | null | undefined,
	height: number | null | undefined,
): string | null {
	if (!width || !height) return null;
	return `${width} × ${height}`;
}

export function cameraLabel(
	safeExif: Record<string, unknown> | null | undefined,
): string | null {
	if (!safeExif) return null;
	const make = typeof safeExif.make === "string" ? safeExif.make : null;
	const model = typeof safeExif.model === "string" ? safeExif.model : null;
	if (make && model) {
		return model.toLowerCase().includes(make.toLowerCase())
			? model
			: `${make} ${model}`;
	}
	return model ?? make;
}

/**
 * Standard lightbox caption stack:
 * 1. title (if set)
 * 2. caption (if set)
 * 3. soft context: location · takenAt
 * 4. else surface fallbackCaption (or blank)
 *
 * Never leads with dimensions/camera EXIF.
 */
export function buildPhotoViewerItem(options: {
	ref: string;
	photo?: ResolvedPhotoAsset | null;
	index?: number;
	fallbackAlt?: string;
	fallbackCaption?: ReactNode;
}): PhotoViewerItem {
	const { ref, photo, index = 0, fallbackAlt, fallbackCaption } = options;

	if (!photo) {
		return {
			ref,
			alt: fallbackAlt ?? `Photo ${index + 1}`,
			caption: fallbackCaption,
		};
	}

	const contextLine = [photo.locationLabel, formatPhotoDate(photo.takenAt)]
		.filter(Boolean)
		.join(" · ");

	const hasStory = Boolean(photo.title) || Boolean(photo.caption);
	const hasContext = contextLine.length > 0;

	const overlayMeta = [
		photo.locationLabel,
		formatPhotoDate(photo.takenAt ?? photo.createdAt, {
			month: "short",
			day: "numeric",
		}),
	]
		.filter(Boolean)
		.join(" · ");

	return {
		ref: photo.displayRef,
		thumbnailRef: photo.thumbnailRef ?? photo.displayRef,
		alt: photo.title ?? fallbackAlt ?? `Photo ${index + 1}`,
		width: photo.width,
		height: photo.height,
		overlayTitle: photo.title,
		overlayMeta: overlayMeta || null,
		caption:
			hasStory || hasContext ? (
				<div className="space-y-1">
					{photo.title && (
						<div className="text-base font-medium text-zinc-100">
							{photo.title}
						</div>
					)}
					{photo.caption && <div>{photo.caption}</div>}
					{hasContext && (
						<div className="text-xs text-zinc-400">{contextLine}</div>
					)}
				</div>
			) : (
				fallbackCaption
			),
	};
}
