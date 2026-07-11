"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { usePhotoUrls } from "@/hooks/usePhotoUrl";

export interface PhotoViewerItem {
	ref: string;
	thumbnailRef?: string | null;
	alt?: string;
	caption?: ReactNode;
	width?: number | null;
	height?: number | null;
	/** Short hover label shown on gallery thumbnails */
	overlayTitle?: string | null;
	/** Secondary hover meta (location, date, etc.) */
	overlayMeta?: string | null;
}

export type PhotoInput = string | PhotoViewerItem;

export function normalizePhoto(photo: PhotoInput): PhotoViewerItem {
	return typeof photo === "string" ? { ref: photo } : photo;
}

interface PhotoLightboxProps {
	photos: PhotoInput[];
	index: number | null;
	onClose: () => void;
	onIndexChange?: (index: number) => void;
}

export function PhotoLightbox({
	photos,
	index,
	onClose,
	onIndexChange,
}: PhotoLightboxProps) {
	const items = useMemo(() => photos.map(normalizePhoto), [photos]);
	const refs = useMemo(() => {
		if (index === null) return [];
		const nearby = new Set<number>([index]);
		if (items.length > 1) {
			nearby.add((index - 1 + items.length) % items.length);
			nearby.add((index + 1) % items.length);
		}
		const resolved: string[] = [];
		for (const i of nearby) {
			const item = items[i];
			if (!item) continue;
			resolved.push(item.ref);
			if (item.thumbnailRef) resolved.push(item.thumbnailRef);
		}
		return Array.from(new Set(resolved));
	}, [index, items]);
	const photoUrlMap = usePhotoUrls(refs);
	const [mounted, setMounted] = useState(false);
	const [urlFallback, setUrlFallback] = useState<string | null>(null);

	useEffect(() => {
		setMounted(true);
	}, []);

	useEffect(() => {
		setUrlFallback(null);
	}, [index]);

	const selectedItem = index === null ? null : (items[index] ?? null);
	const selectedUrl = selectedItem
		? (photoUrlMap.get(selectedItem.ref) ?? urlFallback)
		: null;

	const goTo = (nextIndex: number) => {
		setUrlFallback(null);
		onIndexChange?.(nextIndex);
	};

	const goToPrevious = () => {
		if (index === null || items.length <= 1) return;
		goTo((index - 1 + items.length) % items.length);
	};

	const goToNext = () => {
		if (index === null || items.length <= 1) return;
		goTo((index + 1) % items.length);
	};

	useEffect(() => {
		if (index === null) return;

		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";

		const handleKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				onClose();
				return;
			}
			if (items.length <= 1) return;
			if (event.key === "ArrowLeft") {
				setUrlFallback(null);
				onIndexChange?.((index - 1 + items.length) % items.length);
			}
			if (event.key === "ArrowRight") {
				setUrlFallback(null);
				onIndexChange?.((index + 1) % items.length);
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => {
			document.body.style.overflow = previousOverflow;
			window.removeEventListener("keydown", handleKeyDown);
		};
	}, [index, items.length, onClose, onIndexChange]);

	if (!mounted || index === null || !selectedItem) return null;

	return createPortal(
		<div
			className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
			role="dialog"
			aria-modal="true"
			aria-label={selectedItem.alt ?? "Photo preview"}
			onClick={onClose}
		>
			<button
				type="button"
				aria-label="Close photo preview"
				className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white backdrop-blur transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/50"
				onClick={onClose}
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
							{index + 1} / {items.length}
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
		</div>,
		document.body,
	);
}
