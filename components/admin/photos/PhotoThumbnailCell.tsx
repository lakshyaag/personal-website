"use client";

import { usePhotoUrl } from "@/hooks/usePhotoUrl";

export function PhotoThumbnailCell({
	photoRef,
	alt,
}: {
	photoRef: string;
	alt: string;
}) {
	const url = usePhotoUrl(photoRef);

	return (
		<div className="size-12 shrink-0 overflow-hidden rounded-md bg-muted">
			{url ? (
				<img src={url} alt={alt} className="size-full object-cover" />
			) : (
				<div className="size-full animate-pulse bg-zinc-200 dark:bg-zinc-700" />
			)}
		</div>
	);
}
