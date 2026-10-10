"use client";

import { PhotoLightboxGrid } from "@/components/photos/PhotoLightboxGrid";
import { buildPhotoViewerItem } from "@/components/photos/buildPhotoViewerItem";
import { useResolvedPhotos } from "@/hooks/useResolvedPhotos";
import { type ReactNode, useMemo } from "react";

interface ResolvedPhotoLightboxGridProps {
	refs: string[];
	fallbackCaption?: (ref: string, index: number) => ReactNode;
	fallbackAlt?: (ref: string, index: number) => string;
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
				}),
			),
		[refs, photos, fallbackAlt, fallbackCaption],
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
