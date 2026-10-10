"use client";

import {
	type PhotoInput,
	PhotoLightbox,
	type PhotoViewerItem,
	normalizePhoto,
} from "@/components/photos/PhotoLightbox";
import { useMemo, useState } from "react";

export type { PhotoViewerItem };

interface PhotoLightboxGridProps {
	photos: PhotoInput[];
	gridClassName?: string;
	thumbnailClassName?: string;
	thumbnailImageClassName?: string;
	onPhotoClick?: (url: string) => void;
}

function cn(...classes: Array<string | undefined | false>) {
	return classes.filter(Boolean).join(" ");
}

export function PhotoLightboxGrid({
	photos,
	gridClassName = "mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4",
	thumbnailClassName = "aspect-square w-full rounded",
	thumbnailImageClassName = "object-cover",
	onPhotoClick,
}: PhotoLightboxGridProps) {
	const items = useMemo(() => photos.map(normalizePhoto), [photos]);
	const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

	if (items.length === 0) return null;

	const openPhoto = (index: number, fullUrl: string) => {
		if (onPhotoClick) {
			onPhotoClick(fullUrl);
			return;
		}
		setSelectedIndex(index);
	};

	return (
		<>
			<div className={gridClassName}>
				{items.map((item, index) => {
					const displayUrl = item.ref;
					const thumbnailUrl = item.thumbnailRef
						? item.thumbnailRef
						: displayUrl;

					return (
						<div key={`${item.ref}-${index}`} className="relative">
							{thumbnailUrl && displayUrl ? (
								<button
									type="button"
									aria-label={`Open ${item.alt ?? "photo"}`}
									className={cn(
										"group relative overflow-hidden focus:outline-none focus:ring-2 focus:ring-zinc-500/30",
										thumbnailClassName,
									)}
									onClick={() => openPhoto(index, displayUrl)}
								>
									<img
										src={thumbnailUrl}
										alt={item.alt ?? "Photo"}
										className={cn(
											"h-full w-full transition duration-200 group-hover:scale-[1.02] group-hover:opacity-90",
											thumbnailImageClassName,
										)}
										loading="lazy"
									/>
								</button>
							) : (
								<div
									className={cn(
										"animate-pulse bg-zinc-200 dark:bg-zinc-700",
										thumbnailClassName,
									)}
								/>
							)}
						</div>
					);
				})}
			</div>

			{!onPhotoClick && (
				<PhotoLightbox
					photos={items}
					index={selectedIndex}
					onClose={() => setSelectedIndex(null)}
					onIndexChange={setSelectedIndex}
				/>
			)}
		</>
	);
}
