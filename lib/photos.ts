import { encodeSupabaseRef } from "./photo-refs";

export type PhotoVisibility = "private" | "unlisted" | "public";
export type PhotoDerivativeKind = "thumb" | "card" | "full" | "private_full";
export type PhotoContextType =
	| "airport_visit"
	| "journal"
	| "food"
	| "workout"
	| "fit"
	| "gallery";
export type UploadFolder =
	| "airports"
	| "journal"
	| "food"
	| "workouts"
	| "fits"
	| "gallery";

export function visibilityForFolder(folder: UploadFolder): PhotoVisibility {
	if (folder === "airports" || folder === "gallery") {
		return "public";
	}
	return "private";
}

export function contextTypeForFolder(folder: UploadFolder): PhotoContextType {
	switch (folder) {
		case "airports":
			return "airport_visit";
		case "journal":
			return "journal";
		case "food":
			return "food";
		case "workouts":
			return "workout";
		case "fits":
			return "fit";
		case "gallery":
			return "gallery";
	}
}

export function derivePreferredPhotoRef(
	visibility: PhotoVisibility,
	paths: { publicPath?: string; privatePath?: string },
): string {
	if (visibility === "public" && paths.publicPath) {
		return encodeSupabaseRef("photo-public", paths.publicPath);
	}
	if (paths.privatePath) {
		return encodeSupabaseRef("photo-private-display", paths.privatePath);
	}
	if (paths.publicPath) {
		return encodeSupabaseRef("photo-public", paths.publicPath);
	}
	throw new Error("No display path available for uploaded photo");
}
