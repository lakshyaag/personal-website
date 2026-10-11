import "server-only";
import airportData from "@/data/airports.min.json";
import type {
	Airport,
	PublicFlight,
	PublicFlights,
	PublicPhoto,
} from "@/lib/public-types";
import {
	type CreateRecommendationInput,
	bookListSchema,
	recommendationListSchema,
} from "@/shared/books";
import {
	chronological,
	connects,
	flightCode,
	flightListSchema,
} from "@/shared/flights";
import {
	type LibraryPhoto,
	type Photo,
	type PhotoVariant,
	photoListSchema,
} from "@/shared/photos";
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

const airportsByIdent = new Map(
	(airportData as Airport[]).map((airport) => [airport.ident, airport]),
);
/** Great-circle distance in km. */
function distance(
	a: { lat: number; lon: number },
	b: { lat: number; lon: number },
) {
	const rad = Math.PI / 180;
	const h =
		Math.sin(((b.lat - a.lat) * rad) / 2) ** 2 +
		Math.cos(a.lat * rad) *
			Math.cos(b.lat * rad) *
			Math.sin(((b.lon - a.lon) * rad) / 2) ** 2;
	return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/** Flights for the public airports page, newest first, with the airports they use. */
export async function publicFlights(): Promise<PublicFlights> {
	const { flights } = await publicJson("/v1/flights", flightListSchema, {
		flights: [],
	});
	const ordered = chronological(flights);
	const result: PublicFlight[] = [];
	ordered.forEach((flight, index) => {
		const from = airportsByIdent.get(flight.from);
		const to = airportsByIdent.get(flight.to);
		if (!from || !to) return;
		const previous = ordered[index - 1];
		result.push({
			id: flight.id,
			date: flight.date,
			code: flightCode(flight),
			airlineName:
				flight.airlineName ?? flight.airlineIata ?? flight.airlineIcao ?? "",
			from: flight.from,
			to: flight.to,
			km: Math.round(distance(from, to)),
			aircraft: flight.aircraft,
			registration: flight.registration,
			cabin: flight.cabin,
			connecting: Boolean(previous && connects(previous, flight)),
			// Only public photos appear on the public page. A photo with GPS belongs to whichever
			// end of the flight it was taken nearer; otherwise to the destination.
			photos: flight.photos
				.filter(
					(photo) => photo.visibility === "public" && photo.state === "ready",
				)
				.map((photo) => ({
					...publicPhoto(photo),
					airport:
						photo.latitude !== null &&
						photo.longitude !== null &&
						distance({ lat: photo.latitude, lon: photo.longitude }, from) <
							distance({ lat: photo.latitude, lon: photo.longitude }, to)
							? flight.from
							: flight.to,
				})),
		});
	});
	const used = new Set(result.flatMap((flight) => [flight.from, flight.to]));
	return {
		flights: result.reverse(),
		airports: [...used].flatMap((ident) => {
			const airport = airportsByIdent.get(ident);
			return airport ? [airport] : [];
		}),
	};
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
