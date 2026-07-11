import type { ReactNode } from "react";
import type { ResolvedPhotoAsset } from "@/lib/photo-assets-db";
import type { PhotoViewerItem } from "@/components/photos/PhotoLightbox";

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

export function buildPhotoViewerItem(options: {
	ref: string;
	photo?: ResolvedPhotoAsset | null;
	index?: number;
	fallbackAlt?: string;
	fallbackCaption?: ReactNode;
	includeExifMeta?: boolean;
}): PhotoViewerItem {
	const {
		ref,
		photo,
		index = 0,
		fallbackAlt,
		fallbackCaption,
		includeExifMeta = false,
	} = options;

	if (!photo) {
		return {
			ref,
			alt: fallbackAlt ?? `Photo ${index + 1}`,
			caption: fallbackCaption,
		};
	}

	const metadata = [
		formatPhotoDate(photo.takenAt),
		photo.locationLabel,
		includeExifMeta
			? formatPhotoDimensions(photo.width, photo.height)
			: null,
		includeExifMeta ? cameraLabel(photo.safeExif) : null,
	].filter(Boolean);

	const hasRichCaption =
		Boolean(photo.title) ||
		Boolean(photo.caption) ||
		metadata.length > 0;

	return {
		ref: photo.displayRef,
		thumbnailRef: photo.thumbnailRef ?? photo.displayRef,
		alt: photo.title ?? fallbackAlt ?? `Photo ${index + 1}`,
		caption: hasRichCaption ? (
			<div className="space-y-1">
				{photo.title && (
					<div className="text-base font-medium text-zinc-100">
						{photo.title}
					</div>
				)}
				{photo.caption && <div>{photo.caption}</div>}
				{metadata.length > 0 && (
					<div className="text-xs text-zinc-400">{metadata.join(" · ")}</div>
				)}
			</div>
		) : (
			fallbackCaption
		),
	};
}
