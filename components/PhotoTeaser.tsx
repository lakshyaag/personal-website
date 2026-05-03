"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PhotoLightboxGrid } from "@/components/photos/PhotoLightboxGrid";
import { SvgArrowRight } from "@/components/ui/svg-arrow-right";

interface TeaserPhoto {
	id: string;
	displayRef: string;
	thumbnailRef: string | null;
	title: string | null;
	caption: string | null;
	locationLabel: string | null;
	takenAt: string | null;
	createdAt: string;
}

function formatDate(value: string | null): string | null {
	if (!value) return null;
	return new Date(value).toLocaleDateString("en-US", {
		month: "short",
		year: "numeric",
	});
}

export function PhotoTeaser() {
	const [photos, setPhotos] = useState<TeaserPhoto[]>([]);

	useEffect(() => {
		let cancelled = false;
		async function loadPhotos() {
			try {
				const response = await fetch("/api/photos");
				if (!response.ok) return;
				const data = (await response.json()) as TeaserPhoto[];
				if (!cancelled) {
					setPhotos(data.slice(0, 4));
				}
			} catch (error) {
				console.error(error);
			}
		}
		void loadPhotos();
		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<section>
			<div className="mb-5 flex items-center justify-between">
				<div>
					<h3 className="text-lg font-medium">Photos</h3>
					<p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
						A small contact sheet of things I noticed.
					</p>
				</div>
				<Link
					href="/photos"
					className="font-base group relative inline-flex items-center gap-[1px] font-[450] text-zinc-900 dark:text-zinc-50"
				>
					View gallery
					<SvgArrowRight
						link="/photos"
						className="opacity-0 transition-opacity duration-200 group-hover:opacity-100"
					/>
					<span className="absolute bottom-0.5 left-0 block h-[1px] w-full max-w-0 bg-zinc-900 transition-all duration-200 group-hover:max-w-full" />
				</Link>
			</div>
			{photos.length > 0 ? (
				<PhotoLightboxGrid
					photos={photos.map((photo, index) => ({
						ref: photo.displayRef,
						thumbnailRef: photo.thumbnailRef ?? photo.displayRef,
						alt: photo.title ?? `Photo ${index + 1}`,
						caption: (
							<div className="space-y-1">
								{photo.title && (
									<div className="font-medium text-zinc-100">{photo.title}</div>
								)}
								{photo.caption && <div>{photo.caption}</div>}
								<div className="text-xs text-zinc-400">
									{[
										photo.locationLabel,
										formatDate(photo.takenAt ?? photo.createdAt),
									]
										.filter(Boolean)
										.join(" · ")}
								</div>
							</div>
						),
					}))}
					gridClassName="grid grid-cols-2 gap-3 sm:grid-cols-4"
					thumbnailClassName="aspect-[4/5] w-full rounded-xl"
				/>
			) : (
				<p className="rounded-xl border border-zinc-200 bg-zinc-50/60 px-4 py-3 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/40 dark:text-zinc-400">
					The gallery is being curated. You can still open the archive page.
				</p>
			)}
		</section>
	);
}
