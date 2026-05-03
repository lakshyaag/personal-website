"use client";

import { useEffect, useMemo, useState } from "react";
import { PhotoLightboxGrid } from "@/components/photos/PhotoLightboxGrid";

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

function formatDate(value: string | null): string | null {
	if (!value) return null;
	return new Date(value).toLocaleDateString("en-US", {
		month: "long",
		day: "numeric",
		year: "numeric",
	});
}

function formatDimensions(photo: PublicPhoto): string | null {
	if (!photo.width || !photo.height) return null;
	return `${photo.width} × ${photo.height}`;
}

function cameraLabel(safeExif: Record<string, unknown>): string | null {
	const make = typeof safeExif.make === "string" ? safeExif.make : null;
	const model = typeof safeExif.model === "string" ? safeExif.model : null;
	if (make && model) {
		return model.toLowerCase().includes(make.toLowerCase())
			? model
			: `${make} ${model}`;
	}
	return model ?? make;
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
					A small contact sheet of photos I like. Mostly iPhone, lightly
					catalogued, with the nerdy bits tucked into the viewer.
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
								photos={yearPhotos.map((photo, index) => {
									const taken = formatDate(photo.takenAt);
									const dimensions = formatDimensions(photo);
									const camera = cameraLabel(photo.safeExif);
									const metadata = [
										taken,
										photo.locationLabel,
										dimensions,
										camera,
									].filter(Boolean);

									return {
										ref: photo.displayRef,
										thumbnailRef: photo.thumbnailRef ?? photo.displayRef,
										alt: photo.title ?? `Photo ${index + 1}`,
										caption: (
											<div className="space-y-1">
												{photo.title && (
													<div className="text-base font-medium text-zinc-100">
														{photo.title}
													</div>
												)}
												{photo.caption && <div>{photo.caption}</div>}
												{metadata.length > 0 && (
													<div className="text-xs text-zinc-400">
														{metadata.join(" · ")}
													</div>
												)}
											</div>
										),
									};
								})}
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
