"use client";

import { useCallback, useEffect, useState } from "react";
import PhotoUploader from "@/components/admin/PhotoUploader";
import { PhotoLightboxGrid } from "@/components/photos/PhotoLightboxGrid";
import type { PhotoVisibility } from "@/lib/photos";

interface AdminPhotoItem {
	id: string;
	visibility: PhotoVisibility;
	galleryFeatured: boolean;
	displayRef: string;
}

export default function AdminPhotosPage() {
	const [photos, setPhotos] = useState<AdminPhotoItem[]>([]);
	const [uploadRefs, setUploadRefs] = useState<string[]>([]);
	const [loading, setLoading] = useState(true);

	const loadPhotos = useCallback(async () => {
		setLoading(true);
		try {
			const response = await fetch("/api/photos?admin=true");
			if (!response.ok) {
				throw new Error("Failed to fetch admin photos");
			}
			const data = (await response.json()) as AdminPhotoItem[];
			setPhotos(data);
		} catch (error) {
			console.error(error);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadPhotos();
	}, [loadPhotos]);

	const updatePhoto = useCallback(
		async (id: string, visibility: PhotoVisibility, galleryFeatured: boolean) => {
			const response = await fetch("/api/photos", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id, visibility, galleryFeatured }),
			});
			if (!response.ok) {
				throw new Error("Failed to update photo");
			}
			await loadPhotos();
		},
		[loadPhotos],
	);

	return (
		<main className="mx-auto max-w-6xl px-6 py-12">
			<h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
				Manage Photos
			</h1>
			<p className="mt-2 text-zinc-600 dark:text-zinc-400">
				Upload photos once, then control visibility and gallery publishing.
			</p>

			<div className="mt-8 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
				<PhotoUploader
					label="Upload to unified gallery"
					photos={uploadRefs}
					onChange={(refs) => {
						setUploadRefs(refs);
					}}
					onSuccess={() => {
						void loadPhotos();
					}}
					folder="gallery"
					identifier="gallery"
					onError={() => alert("Upload failed")}
				/>
			</div>

			{loading ? (
				<p className="mt-8 text-zinc-600 dark:text-zinc-400">Loading photos...</p>
			) : photos.length === 0 ? (
				<p className="mt-8 text-zinc-600 dark:text-zinc-400">
					No uploaded photos yet.
				</p>
			) : (
				<div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{photos.map((photo) => (
						<div
							key={photo.id}
							className="rounded-lg border border-zinc-200 p-3 dark:border-zinc-800"
						>
							<PhotoLightboxGrid
								photos={[
									{
										ref: photo.displayRef,
										alt: "Uploaded photo",
										caption: `Photo ${photo.id.slice(0, 8)}`,
									},
								]}
								gridClassName="mb-3 grid grid-cols-1"
								thumbnailClassName="aspect-square w-full rounded"
							/>
							<div className="space-y-2">
								<select
									value={photo.visibility}
									onChange={(event) => {
										void updatePhoto(
											photo.id,
											event.target.value as PhotoVisibility,
											photo.galleryFeatured,
										);
									}}
									className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
								>
									<option value="private">Private</option>
									<option value="unlisted">Unlisted</option>
									<option value="public">Public</option>
								</select>
								<label className="flex items-center gap-2 text-sm text-zinc-700 dark:text-zinc-300">
									<input
										type="checkbox"
										checked={photo.galleryFeatured}
										onChange={(event) => {
											void updatePhoto(
												photo.id,
												photo.visibility,
												event.target.checked,
											);
										}}
									/>
									Feature in `/photos`
								</label>
							</div>
						</div>
					))}
				</div>
			)}
		</main>
	);
}
