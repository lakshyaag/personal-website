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
	return `${base.replace(/\/$/, "")}/public/photos/${photo.id}/${photo.generation}/${variant}`;
}

/** All public photos, optionally only the gallery's featured ones. */
async function publicLibrary(featuredOnly: boolean) {
	const photos: LibraryPhoto[] = [];
	let cursor: string | null = null;
	do {
		const query = new URLSearchParams({ visibility: "public", limit: "200" });
		if (featuredOnly) query.set("featured", "true");
		if (cursor) query.set("cursor", cursor);
		const page = photoListSchema.parse(await workerJson(`/v1/photos?${query}`));
		photos.push(...page.photos);
		cursor = page.nextCursor;
	} while (cursor);
	return photos;
}

/** A public photo in the shape the gallery and lightbox components already render. */
function galleryPhoto(photo: LibraryPhoto) {
	return {
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
	};
}

/** Featured public photos for the gallery. */
export async function publicGallery() {
	return (await publicLibrary(true)).map(galleryPhoto);
}

/** Metadata for public photo URLs (e.g. airport visit photos). Anything else is left unresolved. */
export async function resolvePublicPhotos(refs: string[]) {
	const wanted = new Set(refs);
	return Object.fromEntries(
		(await publicLibrary(false))
			.map(galleryPhoto)
			.filter((photo) => wanted.has(photo.displayRef))
			.map((photo) => [photo.displayRef, photo]),
	);
}
