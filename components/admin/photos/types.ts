import type { PhotoVisibility } from "@/lib/photos";

export interface AdminPhotoItem {
	id: string;
	visibility: PhotoVisibility;
	galleryFeatured: boolean;
	displayRef: string;
	thumbnailRef: string | null;
	createdAt: string;
	takenAt: string | null;
	width: number | null;
	height: number | null;
	title: string | null;
	caption: string | null;
	locationLabel: string | null;
	gpsLatitude: number | null;
	gpsLongitude: number | null;
	gpsAltitude: number | null;
	gpsPublic: boolean;
	contextType: string | null;
	contextId: string | null;
}

export const CONTEXT_LABELS: Record<string, string> = {
	airport_visit: "Airport Visits",
	food: "Food",
	fit: "Fits",
	gallery: "Gallery",
	journal: "Journal",
	workout: "Workouts",
};

export function formatTimestamp(value: string | null): string {
	if (!value) return "—";
	return new Date(value).toLocaleString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

export function formatGps(photo: AdminPhotoItem): string | null {
	if (photo.gpsLatitude === null || photo.gpsLongitude === null) return null;
	const coordinates = `${photo.gpsLatitude.toFixed(4)}, ${photo.gpsLongitude.toFixed(4)}`;
	return photo.gpsAltitude === null
		? coordinates
		: `${coordinates} · ${Math.round(photo.gpsAltitude)}m`;
}

export function contextLabel(contextType: string | null): string {
	if (!contextType) return "Unassigned";
	return CONTEXT_LABELS[contextType] ?? contextType;
}

export function normalizeOptionalText(value: string): string | null {
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}
