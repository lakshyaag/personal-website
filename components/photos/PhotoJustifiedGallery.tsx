"use client";

import {
	type PhotoInput,
	PhotoLightbox,
	type PhotoViewerItem,
	normalizePhoto,
} from "@/components/photos/PhotoLightbox";
import { usePhotoUrls } from "@/hooks/usePhotoUrl";
import { cn } from "@/lib/utils";
import {
	type CSSProperties,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";

interface PhotoJustifiedGalleryProps {
	photos: PhotoInput[];
	/** Target row height in px (desktop). */
	targetRowHeight?: number;
	gap?: number;
	className?: string;
}

type JustifiedRow = {
	indices: number[];
	height: number;
};

function aspectRatio(item: PhotoViewerItem): number {
	if (item.width && item.height && item.width > 0 && item.height > 0) {
		return item.width / item.height;
	}
	return 4 / 3;
}

function computeJustifiedRows(
	items: PhotoViewerItem[],
	containerWidth: number,
	targetRowHeight: number,
	gap: number,
): JustifiedRow[] {
	if (containerWidth <= 0 || items.length === 0) return [];

	const rows: JustifiedRow[] = [];
	let current: number[] = [];
	let aspectSum = 0;

	const finalize = (indices: number[], stretch: boolean) => {
		if (indices.length === 0) return;
		const sum = indices.reduce((acc, i) => acc + aspectRatio(items[i]), 0);
		const gapsWidth = Math.max(0, indices.length - 1) * gap;
		if (!stretch) {
			rows.push({ indices, height: targetRowHeight });
			return;
		}
		const height = (containerWidth - gapsWidth) / sum;
		const clamped = Math.min(
			Math.max(height, targetRowHeight * 0.65),
			targetRowHeight * 1.45,
		);
		rows.push({ indices, height: clamped });
	};

	for (let i = 0; i < items.length; i++) {
		const nextAspect = aspectRatio(items[i]);
		const nextSum = aspectSum + nextAspect;
		const gapsIfAdded = current.length * gap;
		const widthAtTarget = nextSum * targetRowHeight + gapsIfAdded;

		if (current.length > 0 && widthAtTarget > containerWidth) {
			finalize(current, true);
			current = [i];
			aspectSum = nextAspect;
		} else {
			current.push(i);
			aspectSum = nextSum;
		}
	}

	if (current.length > 0) {
		const gapsWidth = Math.max(0, current.length - 1) * gap;
		const naturalWidth = aspectSum * targetRowHeight + gapsWidth;
		const stretch = naturalWidth >= containerWidth * 0.72;
		finalize(current, stretch);
	}

	return rows;
}

export function PhotoJustifiedGallery({
	photos,
	targetRowHeight = 240,
	gap = 12,
	className,
}: PhotoJustifiedGalleryProps) {
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
	const containerRef = useRef<HTMLDivElement>(null);
	const [containerWidth, setContainerWidth] = useState(0);

	useEffect(() => {
		const el = containerRef.current;
		if (!el) return;

		const update = () => {
			setContainerWidth(el.clientWidth);
		};
		update();

		const observer = new ResizeObserver(update);
		observer.observe(el);
		return () => observer.disconnect();
	}, []);

	const responsiveTarget =
		containerWidth > 0 && containerWidth < 640
			? Math.min(targetRowHeight, 168)
			: targetRowHeight;

	const rows = useMemo(
		() => computeJustifiedRows(items, containerWidth, responsiveTarget, gap),
		[items, containerWidth, responsiveTarget, gap],
	);

	if (items.length === 0) return null;

	return (
		<>
			<div ref={containerRef} className={cn("w-full", className)}>
				{containerWidth === 0 ? (
					<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
						{items.slice(0, 6).map((item, index) => (
							<div
								key={`skeleton-${item.ref}-${index}`}
								className="aspect-[4/3] animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800"
							/>
						))}
					</div>
				) : (
					<div className="flex flex-col" style={{ gap }}>
						{rows.map((row, rowIndex) => (
							<div
								key={`row-${rowIndex}`}
								className="flex w-full"
								style={{ gap, height: row.height }}
							>
								{row.indices.map((index) => {
									const item = items[index];
									const displayUrl = photoUrlMap.get(item.ref);
									const thumbnailUrl = item.thumbnailRef
										? photoUrlMap.get(item.thumbnailRef)
										: displayUrl;
									const aspect = aspectRatio(item);
									const showOverlay =
										Boolean(item.overlayTitle) || Boolean(item.overlayMeta);

									const style: CSSProperties = {
										flex: `${aspect} 1 0px`,
										height: row.height,
										minWidth: 0,
									};

									if (!thumbnailUrl || !displayUrl) {
										return (
											<div
												key={`${item.ref}-${index}`}
												style={style}
												className="animate-pulse rounded-xl bg-zinc-200 dark:bg-zinc-800"
											/>
										);
									}

									return (
										<button
											key={`${item.ref}-${index}`}
											type="button"
											aria-label={`Open ${item.alt ?? "photo"}`}
											style={style}
											className="group relative min-w-0 overflow-hidden rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-zinc-500/40"
											onClick={() => setSelectedIndex(index)}
										>
											<img
												src={thumbnailUrl}
												alt={item.alt ?? "Photo"}
												className="h-full w-full object-cover transition duration-300 ease-out group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
												loading="lazy"
											/>
											{showOverlay && (
												<div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-full border-t border-white/10 bg-zinc-950/85 px-3 py-2 opacity-0 transition duration-300 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 motion-reduce:translate-y-0 motion-reduce:opacity-100">
													{item.overlayTitle && (
														<div className="truncate text-left text-sm font-medium text-white">
															{item.overlayTitle}
														</div>
													)}
													{item.overlayMeta && (
														<div className="truncate text-left text-xs text-white/70">
															{item.overlayMeta}
														</div>
													)}
												</div>
											)}
										</button>
									);
								})}
							</div>
						))}
					</div>
				)}
			</div>

			<PhotoLightbox
				photos={items}
				index={selectedIndex}
				onClose={() => setSelectedIndex(null)}
				onIndexChange={setSelectedIndex}
			/>
		</>
	);
}
