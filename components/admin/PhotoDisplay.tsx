"use client";

import { usePhotoUrl, usePhotoUrls } from "@/hooks/usePhotoUrl";

interface PhotoDisplayProps {
	/** Photo reference (HTTP URL or sb:// ref) */
	photoRef: string;
	/** Alt text for the image */
	alt?: string;
	/** Click handler - receives the resolved display URL */
	onClick?: (url: string) => void;
	/** Additional CSS classes */
	className?: string;
	/** Show remove button */
	showRemove?: boolean;
	/** Remove button click handler */
	onRemove?: () => void;
}

/**
 * Single photo thumbnail that resolves sb:// refs to display URLs
 */
export function PhotoThumbnail({
	photoRef,
	alt = "Photo",
	onClick,
	className = "",
	showRemove = false,
	onRemove,
}: PhotoDisplayProps) {
	const displayUrl = usePhotoUrl(photoRef);

	const handleClick = () => {
		if (displayUrl && onClick) {
			onClick(displayUrl);
		}
	};

	return (
		<div className={`relative ${className}`.trim()}>
			{displayUrl ? (
				<>
					{onClick ? (
						<button
							type="button"
							aria-label="Open photo"
							className="group relative aspect-square w-full overflow-hidden rounded focus:outline-none focus:ring-2 focus:ring-zinc-500/20"
							onClick={handleClick}
						>
							<img
								src={displayUrl}
								alt={alt}
								className="absolute inset-0 h-full w-full object-cover group-hover:opacity-80 transition-opacity"
							/>
						</button>
					) : (
						<img
							src={displayUrl}
							alt={alt}
							className="h-24 w-full rounded object-cover"
						/>
					)}
					{showRemove && onRemove && (
						<button
							type="button"
							onClick={onRemove}
							className="absolute right-1 top-1 rounded-full bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600"
						>
							×
						</button>
					)}
				</>
			) : (
				<div className="h-24 w-full rounded bg-zinc-200 dark:bg-zinc-700 animate-pulse" />
			)}
		</div>
	);
}

interface PhotoGridProps {
	/** Array of photo references (HTTP URLs or sb:// refs) */
	photos: string[];
	/** Click handler for photos - receives the resolved display URL */
	onPhotoClick?: (url: string) => void;
	/** Grid columns configuration (default: "grid-cols-3 sm:grid-cols-4") */
	gridCols?: string;
	/** Additional CSS classes */
	className?: string;
}

/**
 * Photo grid that resolves sb:// refs to display URLs
 */
export function PhotoGrid({
	photos,
	onPhotoClick,
	gridCols = "grid-cols-3 sm:grid-cols-4",
	className = "",
}: PhotoGridProps) {
	const photoUrlMap = usePhotoUrls(photos);

	if (photos.length === 0) return null;

	return (
		<div className={`mt-3 grid ${gridCols} gap-2 ${className}`.trim()}>
			{photos.map((photo) => {
				const displayUrl = photoUrlMap.get(photo);
				return (
					<div key={photo} className="relative">
						{displayUrl ? (
							<button
								type="button"
								aria-label="Open photo"
								className="group relative aspect-square w-full overflow-hidden rounded focus:outline-none focus:ring-2 focus:ring-zinc-500/20"
								onClick={() => displayUrl && onPhotoClick?.(displayUrl)}
							>
								<img
									src={displayUrl}
									alt="Entry"
									className="absolute inset-0 h-full w-full object-cover group-hover:opacity-80 transition-opacity"
								/>
							</button>
						) : (
							<div className="absolute inset-0 bg-zinc-200 dark:bg-zinc-700 animate-pulse aspect-square rounded" />
						)}
					</div>
				);
			})}
		</div>
	);
}
