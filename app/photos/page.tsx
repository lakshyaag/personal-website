"use client";

import { useEffect, useState } from "react";
import { PhotoThumbnail } from "@/components/admin/PhotoDisplay";

interface PublicPhoto {
	id: string;
	displayRef: string;
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

	return (
		<main className="mx-auto max-w-6xl px-6 py-12">
			<h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
				Photos
			</h1>
			<p className="mt-2 text-zinc-600 dark:text-zinc-400">
				Featured photos from the unified media pipeline.
			</p>

			{loading ? (
				<p className="mt-8 text-zinc-600 dark:text-zinc-400">Loading photos...</p>
			) : photos.length === 0 ? (
				<p className="mt-8 text-zinc-600 dark:text-zinc-400">
					No featured photos yet.
				</p>
			) : (
				<div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
					{photos.map((photo) => (
						<PhotoThumbnail
							key={photo.id}
							photoRef={photo.displayRef}
							alt="Featured photo"
							className="aspect-square"
						/>
					))}
				</div>
			)}
		</main>
	);
}
