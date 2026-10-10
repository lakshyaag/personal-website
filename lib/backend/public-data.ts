import "server-only";
import type { PublicPhoto, PublicVisit } from "@/lib/public-types";
import {
	type CreateRecommendationInput,
	bookListSchema,
	recommendationListSchema,
} from "@/shared/books";
import {
	type LibraryPhoto,
	type Photo,
	type PhotoVariant,
	photoListSchema,
} from "@/shared/photos";
import { visitListSchema } from "@/shared/visits";
import { revalidateTag } from "next/cache";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { workerJson } from "./worker";

/**
 * Data for the public pages. The Next.js server holds the Worker secret; visitors only see these
 * filtered views. Reads are cached under one tag, which every admin change expires.
 */
const PUBLIC_TAG = "public";
export const refreshPublicData = () => revalidateTag(PUBLIC_TAG, { expire: 0 });

async function publicJson<T>(
	path: string,
	schema: z.ZodType<T>,
	fallback: T,
): Promise<T> {
	try {
		return schema.parse(
			await workerJson(path, {
				// Vercel's data cache outlives deploys; keying it by deployment means a new build
				// never reads a response shaped for older code.
				headers: {
					"X-Deployment": process.env.VERCEL_DEPLOYMENT_ID ?? "local",
				},
				next: { revalidate: 3600, tags: [PUBLIC_TAG] },
			}),
		);
	} catch (error) {
		unstable_rethrow(error);
		// A Worker outage leaves a section empty rather than breaking the whole page.
		console.error(
			JSON.stringify({
				code: "PUBLIC_READ_FAILED",
				path,
				error: String(error),
			}),
		);
		return fallback;
	}
}

/** Unauthenticated, immutable URL served by the Worker. Only valid while the photo is public. */
function publicPhotoUrl(
	photo: Pick<Photo, "id" | "generation">,
	variant: PhotoVariant,
) {
	const base = process.env.CLOUDFLARE_WORKER_URL ?? "";
	return `${base.replace(/\/$/, "")}/public/photos/${photo.id}/${photo.generation}/${variant}`;
}
function publicPhoto(photo: Photo): PublicPhoto {
	return {
		id: photo.id,
		displayRef: publicPhotoUrl(photo, "display"),
		thumbnailRef: publicPhotoUrl(photo, "thumb"),
		createdAt: photo.createdAt,
		takenAt: photo.takenAt ?? null,
		width: photo.width ?? null,
		height: photo.height ?? null,
		title: photo.title ?? null,
		caption: photo.caption ?? null,
		locationLabel: photo.location ?? null,
	};
}

/** Featured public photos for the gallery and homepage. */
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
		const page = await publicJson(`/v1/photos?${query}`, photoListSchema, {
			photos: [],
			nextCursor: null,
		});
		photos.push(...page.photos);
		cursor = page.nextCursor;
	} while (cursor);
	return photos.map(publicPhoto);
}

export async function publicVisits(): Promise<PublicVisit[]> {
	const { visits } = await publicJson("/v1/visits", visitListSchema, {
		visits: [],
	});
	return visits.map((visit) => {
		// Only public photos appear on the public map.
		const photos = visit.photos
			.filter(
				(photo) => photo.visibility === "public" && photo.state === "ready",
			)
			.map(publicPhoto);
		return {
			id: visit.id,
			airportIdent: visit.airportIdent,
			date: visit.date,
			flightNumbers: visit.flightNumbers.length
				? visit.flightNumbers
				: undefined,
			isLayover: visit.isLayover,
			notes: visit.notes,
			photos: photos.length ? photos : undefined,
		};
	});
}
export async function publicBooks() {
	return (await publicJson("/v1/books", bookListSchema, { books: [] })).books;
}
export async function publicRecommendations() {
	return (
		await publicJson("/v1/recommendations", recommendationListSchema, {
			recommendations: [],
		})
	).recommendations;
}
export async function submitRecommendation(input: CreateRecommendationInput) {
	await workerJson("/v1/recommendations", {
		method: "POST",
		body: JSON.stringify(input),
	});
	refreshPublicData();
}
