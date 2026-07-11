"use client";

import { useMemo, type ReactNode } from "react";
import { PhotoLightboxGrid } from "@/components/photos/PhotoLightboxGrid";
import { buildPhotoViewerItem } from "@/components/photos/buildPhotoViewerItem";
import { useResolvedPhotos } from "@/hooks/useResolvedPhotos";

interface ResolvedPhotoLightboxGridProps {
	refs: string[];
	fallbackCaption?: (ref: string, index: number) => ReactNode;
	fallbackAlt?: (ref: string, index: number) => string;
	includeExifMeta?: boolean;
	gridClassName?: string;
	thumbnailClassName?: string;
	thumbnailImageClassName?: string;
	onPhotoClick?: (url: string) => void;
}

/**
 * Lightbox grid that resolves stored refs against photo_assets metadata.
 */
export function ResolvedPhotoLightboxGrid({
	refs,
	fallbackCaption,
	fallbackAlt,
	includeExifMeta = false,
	gridClassName,
	thumbnailClassName,
	thumbnailImageClassName,
	onPhotoClick,
}: ResolvedPhotoLightboxGridProps) {
	const { photos } = useResolvedPhotos(refs);

	const items = useMemo(
		() =>
			refs.map((ref, index) =>
				buildPhotoViewerItem({
					ref,
					photo: photos.get(ref),
					index,
					fallbackAlt: fallbackAlt?.(ref, index),
					fallbackCaption: fallbackCaption?.(ref, index),
					includeExifMeta,
				}),
			),
		[refs, photos, fallbackAlt, fallbackCaption, includeExifMeta],
	);

	return (
		<PhotoLightboxGrid
			photos={items}
			gridClassName={gridClassName}
			thumbnailClassName={thumbnailClassName}
			thumbnailImageClassName={thumbnailImageClassName}
			onPhotoClick={onPhotoClick}
		/>
	);
}
