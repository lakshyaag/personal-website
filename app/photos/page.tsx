"use client";

import { useEffect, useMemo, useState } from "react";
import { PhotoLightboxGrid } from "@/components/photos/PhotoLightboxGrid";
import {
	buildPhotoViewerItem,
	formatPhotoDate,
} from "@/components/photos/buildPhotoViewerItem";
import type { ResolvedPhotoAsset } from "@/lib/photo-assets-db";

interface PublicPhoto {
	id: string;
	displayRef: string;
	thumbnailRef: string | null;
	createdAt: string;
	takenAt: string | null;
	width: number | null;
	height: number | null;
	safeExif: Record<string, unknown>;
	title: string | null;
	caption: string | null;
	locationLabel: string | null;
}

function displayDate(photo: PublicPhoto): string {
	return photo.takenAt ?? photo.createdAt;
}

function yearForPhoto(photo: PublicPhoto): string {
	return new Date(displayDate(photo)).getFullYear().toString();
}

function toResolved(photo: PublicPhoto): ResolvedPhotoAsset {
	return {
		id: photo.id,
		visibility: "public",
		displayRef: photo.displayRef,
		thumbnailRef: photo.thumbnailRef,
		createdAt: photo.createdAt,
		takenAt: photo.takenAt,
		width: photo.width,
		height: photo.height,
		safeExif: photo.safeExif,
		title: photo.title,
		caption: photo.caption,
		locationLabel: photo.locationLabel,
	};
}

export default function PhotosPage() {
	const [photos, setPhotos] = useState<PublicPhoto[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		let cancelled = false;
		async function load() {
			try {
				const response = await fetch("/api/photos");
				if (!response.ok) {
					throw new Error("Failed to load public photos");
				}
				const data = (await response.json()) as PublicPhoto[];
				if (!cancelled) {
					setPhotos(data);
				}
			} catch (error) {
				console.error(error);
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		}
		load();
		return () => {
			cancelled = true;
		};
	}, []);

	const groupedPhotos = useMemo(() => {
		const sorted = [...photos].sort(
			(a, b) =>
				new Date(displayDate(b)).getTime() - new Date(displayDate(a)).getTime(),
		);
		const groups = new Map<string, PublicPhoto[]>();
		for (const photo of sorted) {
			const year = yearForPhoto(photo);
			const list = groups.get(year) ?? [];
			list.push(photo);
			groups.set(year, list);
		}
		return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a));
	}, [photos]);

	return (
		<main className="mx-auto max-w-6xl px-6 py-12">
			<div className="max-w-2xl">
				<p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
					Photo Archive
				</p>
				<h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
					Things I noticed
				</h1>
				<p className="mt-4 text-zinc-600 dark:text-zinc-400">
					A collection of photos from everyday life and places I have been.
				</p>
			</div>

			{loading ? (
				<p className="mt-12 text-zinc-600 dark:text-zinc-400">
					Loading photos...
				</p>
			) : photos.length === 0 ? (
				<p className="mt-12 text-zinc-600 dark:text-zinc-400">
					No featured photos yet.
				</p>
			) : (
				<div className="mt-12 space-y-14">
					{groupedPhotos.map(([year, yearPhotos]) => (
						<section key={year} className="grid gap-6 md:grid-cols-[9rem_1fr]">
							<div className="md:sticky md:top-24 md:self-start">
								<h2 className="text-2xl font-semibold text-zinc-950 dark:text-zinc-50">
									{year}
								</h2>
								<p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
									{yearPhotos.length} frame{yearPhotos.length === 1 ? "" : "s"}
								</p>
							</div>
							<PhotoLightboxGrid
								photos={yearPhotos.map((photo, index) =>
									buildPhotoViewerItem({
										ref: photo.displayRef,
										photo: toResolved(photo),
										index,
										includeExifMeta: true,
										fallbackCaption: formatPhotoDate(photo.createdAt),
									}),
								)}
								gridClassName="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4"
								thumbnailClassName="aspect-[4/5] w-full rounded-xl"
							/>
						</section>
					))}
				</div>
			)}
		</main>
	);
}
