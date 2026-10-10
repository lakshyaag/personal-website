import "server-only";
import {
	type LibraryPhoto,
	type PhotoVariant,
	photoListSchema,
} from "@/shared/photos";
import { workerJson } from "./worker";

/** Unauthenticated, immutable URL served by the Worker. Only valid while the photo is public. */
export function publicPhotoUrl(
	photo: Pick<LibraryPhoto, "id" | "generation">,
	variant: PhotoVariant,
) {
	const base = process.env.CLOUDFLARE_WORKER_URL ?? "";
	return `${base.replace(/\/$/, "")}/public/photos/${photo.id}/${photo.generation}/${variant}.webp`;
}

/** Featured public photos in the shape the gallery components already render. */
export async function publicGallery() {
	const photos: LibraryPhoto[] = [];
	let cursor: string | null = null;
	do {
		const query = new URLSearchParams({
			visibility: "public",
			featured: "true",
			limit: "200",
		});
		if (cursor) query.set("cursor", cursor);
		const page = photoListSchema.parse(await workerJson(`/v1/photos?${query}`));
		photos.push(...page.photos);
		cursor = page.nextCursor;
	} while (cursor);
	return photos.map((photo) => ({
		id: photo.id,
		visibility: photo.visibility,
		galleryFeatured: photo.featured,
		createdAt: photo.createdAt,
		takenAt: photo.takenAt,
		width: photo.width,
		height: photo.height,
		safeExif: {
			make: photo.camera?.make ?? null,
			model: photo.camera?.model ?? null,
			lensModel: photo.camera?.lens ?? null,
			fNumber: photo.camera?.fNumber ?? null,
			exposureTime: photo.camera?.exposureTime ?? null,
			iso: photo.camera?.iso ?? null,
		},
		title: photo.title,
		caption: photo.caption,
		locationLabel: photo.location,
		gpsLatitude: photo.showLocation ? photo.latitude : null,
		gpsLongitude: photo.showLocation ? photo.longitude : null,
		gpsAltitude: null,
		gpsPublic: photo.showLocation,
		displayRef: publicPhotoUrl(photo, "display"),
		thumbnailRef: publicPhotoUrl(photo, "thumb"),
		contextType: photo.links[0]?.context ?? null,
		contextId: photo.links[0]?.contextId ?? null,
	}));
}
