"use client";

import { PhotoLightboxGrid } from "@/components/photos/PhotoLightboxGrid";
import type { Photo } from "@/shared/photos";
import { type DraftPhoto, photoIsReady } from "./PhotoField";
import { adminRequest } from "./client";

/** Saved photos as PhotoField drafts. */
export function toDrafts(photos: Photo[] = []): DraftPhoto[] {
	return photos.map((photo) => ({
		id: photo.id,
		photo,
		existing: true,
		progress: 100,
		uploading: false,
	}));
}
/** Saving waits until every photo has finished uploading. */
export function photosReady(drafts: DraftPhoto[]) {
	return drafts.every(photoIsReady);
}
/** Whether the draft still holds exactly the saved photos, in order. */
export function samePhotos(drafts: DraftPhoto[], saved: Photo[] = []) {
	return (
		drafts.map((item) => item.id).join() ===
		saved.map((photo) => photo.id).join()
	);
}
/** Removes uploads that were never saved to an entry. Attached photos are untouched. */
export async function discardUploads(drafts: DraftPhoto[]) {
	await Promise.all(
		drafts
			.filter((item) => !item.existing && item.photo)
			.map((item) =>
				adminRequest(`photos/${item.id}`, { method: "DELETE" }).catch(
					() => undefined,
				),
			),
	);
}

/** Private library photos, served through the authenticated admin API. */
export function LibraryPhotoGrid({ photos }: { photos: Photo[] }) {
	if (!photos.length) return null;
	return (
		<PhotoLightboxGrid
			photos={photos.map((photo) => ({
				ref: `/api/admin/photos/${photo.id}/display`,
				thumbnailRef: `/api/admin/photos/${photo.id}/thumb`,
				alt: photo.title ?? photo.fileName,
				width: photo.width,
				height: photo.height,
			}))}
		/>
	);
}
