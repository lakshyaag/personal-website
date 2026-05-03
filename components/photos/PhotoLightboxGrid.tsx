"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { usePhotoUrls } from "@/hooks/usePhotoUrl";

type PhotoInput = string | PhotoViewerItem;

export interface PhotoViewerItem {
	ref: string;
	thumbnailRef?: string | null;
	alt?: string;
	caption?: ReactNode;
}

interface PhotoLightboxGridProps {
	photos: PhotoInput[];
	gridClassName?: string;
	thumbnailClassName?: string;
	thumbnailImageClassName?: string;
	onPhotoClick?: (url: string) => void;
}

function normalizePhoto(photo: PhotoInput): PhotoViewerItem {
	return typeof photo === "string" ? { ref: photo } : photo;
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
	const refs = useMemo(() => {
		return Array.from(
			new Set(
				items.flatMap((item) =>
					item.thumbnailRef ? [item.ref, item.thumbnailRef] : [item.ref],
				),
			),
		);
	}, [items]);
	const photoUrlMap = usePhotoUrls(refs);
	const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
	const [selectedUrlFallback, setSelectedUrlFallback] = useState<string | null>(
		null,
	);
	const [mounted, setMounted] = useState(false);

	useEffect(() => {
		setMounted(true);
	}, []);

	const selectedItem =
		selectedIndex === null ? null : items[selectedIndex] ?? null;
	const selectedUrl = selectedItem
		? photoUrlMap.get(selectedItem.ref) ?? selectedUrlFallback
		: null;

	const closeLightbox = () => {
		setSelectedIndex(null);
		setSelectedUrlFallback(null);
	};

	useEffect(() => {
		if (selectedIndex === null || onPhotoClick) return;

		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				closeLightbox();
				return;
			}
			if (items.length <= 1) return;
			if (event.key === "ArrowLeft") {
				setSelectedUrlFallback(null);
				setSelectedIndex((current) =>
					current === null ? current : (current - 1 + items.length) % items.length,
				);
			}
			if (event.key === "ArrowRight") {
				setSelectedUrlFallback(null);
				setSelectedIndex((current) =>
					current === null ? current : (current + 1) % items.length,
				);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => {
			document.body.style.overflow = previousOverflow;
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [items.length, onPhotoClick, selectedIndex]);

	if (items.length === 0) return null;

	const openPhoto = (index: number, fullUrl: string) => {
		if (onPhotoClick) {
			onPhotoClick(fullUrl);
			return;
		}
		setSelectedIndex(index);
		setSelectedUrlFallback(fullUrl);
	};

	const goToPrevious = () => {
		setSelectedUrlFallback(null);
		setSelectedIndex((current) =>
			current === null ? current : (current - 1 + items.length) % items.length,
		);
	};

	const goToNext = () => {
		setSelectedUrlFallback(null);
		setSelectedIndex((current) =>
			current === null ? current : (current + 1) % items.length,
		);
	};

	const lightbox =
		mounted && selectedIndex !== null && !onPhotoClick && selectedItem ? (
			<div
				className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
				role="dialog"
				aria-modal="true"
				aria-label={selectedItem.alt ?? "Photo preview"}
				onClick={closeLightbox}
			>
				<button
					type="button"
					aria-label="Close photo preview"
					className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white backdrop-blur transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
					onClick={closeLightbox}
				>
					<X className="h-5 w-5" />
				</button>

				{items.length > 1 && (
					<button
						type="button"
						aria-label="Previous photo"
						className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white backdrop-blur transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
						onClick={(event) => {
							event.stopPropagation();
							goToPrevious();
						}}
					>
						<ChevronLeft className="h-6 w-6" />
					</button>
				)}

				<div
					className="flex max-h-[92vh] max-w-[92vw] flex-col items-center gap-3"
					onClick={(event) => event.stopPropagation()}
				>
					{selectedUrl ? (
						<img
							src={selectedUrl}
							alt={selectedItem.alt ?? "Photo"}
							className="max-h-[82vh] max-w-full rounded-xl object-contain shadow-2xl"
						/>
					) : (
						<div className="h-[60vh] w-[70vw] animate-pulse rounded-xl bg-white/10" />
					)}
					<div className="max-w-3xl text-center text-sm text-zinc-200">
						{selectedItem.caption && <div>{selectedItem.caption}</div>}
						{items.length > 1 && (
							<div className="mt-1 text-xs text-zinc-400">
								{selectedIndex + 1} / {items.length}
							</div>
						)}
					</div>
				</div>

				{items.length > 1 && (
					<button
						type="button"
						aria-label="Next photo"
						className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white backdrop-blur transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
						onClick={(event) => {
							event.stopPropagation();
							goToNext();
						}}
					>
						<ChevronRight className="h-6 w-6" />
					</button>
				)}
			</div>
		) : null;

	return (
		<>
			<div className={gridClassName}>
				{items.map((item, index) => {
					const displayUrl = photoUrlMap.get(item.ref);
					const thumbnailUrl = item.thumbnailRef
						? photoUrlMap.get(item.thumbnailRef)
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

			{lightbox ? createPortal(lightbox, document.body) : null}
		</>
	);
}
