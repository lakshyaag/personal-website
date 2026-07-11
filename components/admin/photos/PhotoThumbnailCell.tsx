"use client";

import { usePhotoUrl } from "@/hooks/usePhotoUrl";

export function PhotoThumbnailCell({
	photoRef,
	alt,
	onClick,
}: {
	photoRef: string;
	alt: string;
	onClick?: () => void;
}) {
	const url = usePhotoUrl(photoRef);

	const content = url ? (
		<img src={url} alt={alt} className="size-full object-cover" />
	) : (
		<div className="size-full animate-pulse bg-zinc-200 dark:bg-zinc-700" />
	);

	if (onClick) {
		return (
			<button
				type="button"
				aria-label={`Preview ${alt}`}
				className="size-12 shrink-0 overflow-hidden rounded-md bg-muted transition hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-zinc-500/30"
				onClick={(event) => {
					event.stopPropagation();
					onClick();
				}}
			>
				{content}
			</button>
		);
	}

	return (
		<div className="size-12 shrink-0 overflow-hidden rounded-md bg-muted">
			{content}
		</div>
	);
}
