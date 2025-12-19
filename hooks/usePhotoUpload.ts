"use client";

import {
	type Dispatch,
	type SetStateAction,
	useCallback,
	useState,
} from "react";
import { createClient } from "@/lib/supabase-client";
import { encodeSupabaseRef } from "@/lib/photo-refs";

export type UploadFolder = "airports" | "journal" | "food" | "workouts";

export interface UsePhotoUploadOptions {
	folder: UploadFolder;
	identifier: string;
	onSuccess?: (urls: string[]) => void;
}

export interface UsePhotoUploadReturn {
	photos: string[];
	uploading: boolean;
	uploadPhotos: (files: FileList | null) => Promise<void>;
	removePhoto: (url: string) => void;
	setPhotos: Dispatch<SetStateAction<string[]>>;
	clearPhotos: () => void;
}

/**
 * Generate a UUID with fallback for older/mobile browsers
 * crypto.randomUUID() is not available in all mobile browsers
 */
function generateUUID(): string {
	// Use crypto.randomUUID if available (modern browsers)
	if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
		return crypto.randomUUID();
	}

	// Fallback using crypto.getRandomValues (broader support, including mobile)
	if (typeof crypto !== "undefined" && typeof crypto.getRandomValues === "function") {
		const bytes = new Uint8Array(16);
		crypto.getRandomValues(bytes);
		// Set version (4) and variant (RFC4122)
		bytes[6] = (bytes[6] & 0x0f) | 0x40;
		bytes[8] = (bytes[8] & 0x3f) | 0x80;
		const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
		return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
	}

	// Last resort fallback using Math.random (not cryptographically secure but works everywhere)
	return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
		const r = (Math.random() * 16) | 0;
		const v = c === "x" ? r : (r & 0x3) | 0x8;
		return v.toString(16);
	});
}

/**
 * Get the appropriate bucket for a folder
 * - airports: public bucket (airports-photos)
 * - journal/food/workouts: private bucket (private-photos)
 */
function getBucketForFolder(folder: UploadFolder): string {
	return folder === "airports" ? "airports-photos" : "private-photos";
}

/**
 * Generate a unique object path for the file
 */
function generateObjectPath(
	folder: UploadFolder,
	identifier: string,
	file: File,
): string {
	const timestamp = Date.now();
	const uuid = generateUUID();
	const ext = file.name.split(".").pop() || "jpg";
	return `${folder}/photos/${identifier}/${timestamp}-${uuid}.${ext}`;
}

function usePhotoUpload(
	options: UsePhotoUploadOptions,
): UsePhotoUploadReturn {
	const { folder, identifier, onSuccess } = options;
	const [photos, setPhotos] = useState<string[]>([]);
	const [uploading, setUploading] = useState(false);

	const uploadPhotos = useCallback(
		async (files: FileList | null) => {
			if (!files || files.length === 0) return;
			if (!identifier) {
				throw new Error("Missing upload identifier");
			}

			setUploading(true);
			try {
				const supabase = createClient();
				const bucket = getBucketForFolder(folder);
				const isPublicBucket = folder === "airports";

				const newRefs: string[] = [];

				for (const file of Array.from(files)) {
					const objectPath = generateObjectPath(folder, identifier, file);

					// Upload directly to Supabase Storage
					const { error } = await supabase.storage
						.from(bucket)
						.upload(objectPath, file, {
							contentType: file.type,
							upsert: false,
					});

					if (error) {
						console.error("Upload error:", error);
						throw new Error(`Upload failed: ${error.message}`);
					}

					// For public bucket (airports), store the public URL
					// For private bucket, store the sb:// reference
					if (isPublicBucket) {
						const { data: urlData } = supabase.storage
							.from(bucket)
							.getPublicUrl(objectPath);
						newRefs.push(urlData.publicUrl);
					} else {
						newRefs.push(encodeSupabaseRef(bucket, objectPath));
					}
				}

				setPhotos((prev) => [...prev, ...newRefs]);
				onSuccess?.(newRefs);
			} catch (error) {
				console.error("Photo upload failed:", error);
				throw error;
			} finally {
				setUploading(false);
			}
		},
		[folder, identifier, onSuccess],
	);

	const removePhoto = useCallback((url: string) => {
		setPhotos((prev) => {
			const index = prev.indexOf(url);
			if (index === -1) return prev;
			const next = [...prev];
			next.splice(index, 1);
			return next;
		});
	}, []);

	const clearPhotos = useCallback(() => setPhotos([]), []);

	return {
		photos,
		uploading,
		uploadPhotos,
		removePhoto,
		setPhotos,
		clearPhotos,
	};
}

export default usePhotoUpload;
