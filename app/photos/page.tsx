"use client";

import { PhotoJustifiedGallery } from "@/components/photos/PhotoJustifiedGallery";
import { buildPhotoViewerItem } from "@/components/photos/buildPhotoViewerItem";
import type { ResolvedPhotoAsset } from "@/lib/photo-assets-db";
import {
	TRANSITION_SECTION,
	VARIANTS_CONTAINER,
	VARIANTS_SECTION,
} from "@/lib/utils";
import { motion } from "motion/react";
import { useEffect, useMemo, useState } from "react";

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

function monthKeyForPhoto(photo: PublicPhoto): string {
	const date = new Date(displayDate(photo));
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	return `${year}-${month}`;
}

function formatMonthHeading(monthKey: string): string {
	const [year, month] = monthKey.split("-").map(Number);
	const date = new Date(year, month - 1, 1);
	return date.toLocaleDateString("en-US", {
		month: "long",
		year: "numeric",
	});
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
			const key = monthKeyForPhoto(photo);
			const list = groups.get(key) ?? [];
			list.push(photo);
			groups.set(key, list);
		}
		return Array.from(groups.entries()).sort(([a], [b]) => b.localeCompare(a));
	}, [photos]);

	return (
		<motion.main
			className="mx-auto max-w-6xl px-2 py-12 sm:px-4"
			variants={VARIANTS_CONTAINER}
			initial="hidden"
			animate="visible"
		>
			<motion.div
				variants={VARIANTS_SECTION}
				transition={TRANSITION_SECTION}
				className="max-w-2xl px-4 sm:px-2"
			>
				<p className="text-xs font-semibold uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-400">
					Photo Archive
				</p>
				<h1 className="mt-3 text-4xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
					Things I noticed
				</h1>
				<p className="mt-4 text-zinc-600 dark:text-zinc-400">
					A collection of photos from everyday life and places I have been.
				</p>
			</motion.div>

			{loading ? (
				<p className="mt-12 px-4 text-zinc-600 dark:text-zinc-400 sm:px-2">
					Loading photos...
				</p>
			) : photos.length === 0 ? (
				<p className="mt-12 px-4 text-zinc-600 dark:text-zinc-400 sm:px-2">
					No featured photos yet.
				</p>
			) : (
				<div className="mt-14 space-y-16">
					{groupedPhotos.map(([monthKey, monthPhotos]) => (
						<motion.section
							key={monthKey}
							variants={VARIANTS_SECTION}
							transition={TRANSITION_SECTION}
							className="space-y-5"
						>
							<div className="flex items-center gap-3 px-4 sm:px-2">
								<h2 className="shrink-0 text-lg font-semibold text-zinc-950 dark:text-zinc-50">
									{formatMonthHeading(monthKey)}
								</h2>
								<div className="h-px flex-1 bg-zinc-200 dark:bg-zinc-800" />
								<p className="shrink-0 text-sm text-zinc-500 dark:text-zinc-400">
									{monthPhotos.length} frame
									{monthPhotos.length === 1 ? "" : "s"}
								</p>
							</div>
							<PhotoJustifiedGallery
								photos={monthPhotos.map((photo, index) =>
									buildPhotoViewerItem({
										ref: photo.displayRef,
										photo: toResolved(photo),
										index,
									}),
								)}
								gap={12}
								targetRowHeight={248}
							/>
						</motion.section>
					))}
				</div>
			)}
		</motion.main>
	);
}
