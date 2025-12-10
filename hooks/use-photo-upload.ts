/**
 * Photo upload hook for admin modules
 * Consolidates photo upload logic used across workouts, journal, food, and airports
 */

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { apiUpload } from "@/lib/api-utils";

interface UsePhotoUploadOptions {
	/** Folder name for organizing uploads (e.g., "workouts", "journal") */
	folder: string;
	/** Identifier for the upload (e.g., date without dashes) */
	identifier: string;
	/** Initial photos */
	initialPhotos?: string[];
	/** Called when photos change */
	onPhotosChange?: (photos: string[]) => void;
}

export function usePhotoUpload({
	folder,
	identifier,
	initialPhotos = [],
	onPhotosChange,
}: UsePhotoUploadOptions) {
	const [photos, setPhotos] = useState<string[]>(initialPhotos);
	const [uploading, setUploading] = useState(false);

	/**
	 * Upload files and add to photos list
	 */
	const uploadPhotos = useCallback(
		async (files: FileList | null) => {
			if (!files || files.length === 0) return;

			setUploading(true);
			try {
				const urls: string[]  = [];

				for (const file of Array.from(files)) {
					const result = await apiUpload("/api/upload", file, folder, identifier);

					if (!result.success || !result.data) {
						throw new Error(result.error || "Upload failed");
					}

					urls.push(result.data.url);
				}

				const newPhotos = [...photos, ...urls];
				setPhotos(newPhotos);
				onPhotosChange?.(newPhotos);

				toast.success(
					`Uploaded ${urls.length} photo${urls.length > 1 ? "s" : ""}`
				);
			} catch (err) {
				console.error("Photo upload error:", err);
				toast.error(
					err instanceof Error ? err.message : "Failed to upload photos"
				);
			} finally {
				setUploading(false);
			}
		},
		[folder, identifier, photos, onPhotosChange]
	);

	/**
	 * Remove a photo from the list
	 */
	const removePhoto = useCallback(
		(photoUrl: string) => {
			const newPhotos = photos.filter((p) => p !== photoUrl);
			setPhotos(newPhotos);
			onPhotosChange?.(newPhotos);
		},
		[photos, onPhotosChange]
	);

	/**
	 * Clear all photos
	 */
	const clearPhotos = useCallback(() => {
		setPhotos([]);
		onPhotosChange?.([]);
	}, [onPhotosChange]);

	/**
	 * Set photos (for loading existing entries)
	 */
	const setPhotosList = useCallback(
		(newPhotos: string[]) => {
			setPhotos(newPhotos);
			onPhotosChange?.(newPhotos);
		},
		[onPhotosChange]
	);

	return {
		photos,
		uploading,
		uploadPhotos,
		removePhoto,
		clearPhotos,
		setPhotosList,
	};
}
