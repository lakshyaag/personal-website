"use client";

import { PhotoLightboxGrid } from "@/components/photos/PhotoLightboxGrid";
import { buildPhotoViewerItem } from "@/components/photos/buildPhotoViewerItem";
import type { Airport, PublicPhoto } from "@/lib/public-types";

export const continentNames: Record<string, string> = {
	AF: "Africa",
	AS: "Asia",
	EU: "Europe",
	NA: "North America",
	SA: "South America",
	OC: "Oceania",
	AN: "Antarctica",
};

export const airportCode = (airport: Airport | undefined, ident: string) =>
	airport?.iata_code || ident;

export function formatDate(date: string) {
	const [year, month, day] = date.split("-").map(Number);
	return new Date(year, month - 1, day).toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

export function FlightPhotos({
	photos,
	caption,
	thumbnailClassName = "h-32 w-full rounded-lg",
}: {
	photos: PublicPhoto[];
	caption: string;
	thumbnailClassName?: string;
}) {
	if (!photos.length) return null;
	return (
		<PhotoLightboxGrid
			photos={photos.map((photo, index) =>
				buildPhotoViewerItem({
					ref: photo.displayRef,
					photo,
					index,
					fallbackAlt: `${caption} photo ${index + 1}`,
					fallbackCaption: caption,
				}),
			)}
			gridClassName="grid grid-cols-2 gap-2 sm:grid-cols-3"
			thumbnailClassName={thumbnailClassName}
		/>
	);
}
