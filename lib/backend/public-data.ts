import "server-only";
import {
	type CreateRecommendationInput,
	bookListSchema,
	recommendationListSchema,
} from "@/shared/books";
import { visitListSchema } from "@/shared/visits";
import { publicPhotoUrl } from "./public-photos";
import { workerJson } from "./worker";

/**
 * Data for the public pages, in the shapes they already render. The Next.js server holds the
 * Worker secret; visitors only ever see these filtered views.
 */
export async function publicVisits() {
	const { visits } = visitListSchema.parse(await workerJson("/v1/visits"));
	return visits.map((visit) => {
		// Only public photos appear on the public map.
		const photos = visit.photos
			.filter(
				(photo) => photo.visibility === "public" && photo.state === "ready",
			)
			.map((photo) => publicPhotoUrl(photo, "display"));
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
	return bookListSchema.parse(await workerJson("/v1/books")).books;
}
export async function publicRecommendations() {
	return recommendationListSchema.parse(await workerJson("/v1/recommendations"))
		.recommendations;
}
export async function submitRecommendation(input: CreateRecommendationInput) {
	await workerJson("/v1/recommendations", {
		method: "POST",
		body: JSON.stringify(input),
	});
}
