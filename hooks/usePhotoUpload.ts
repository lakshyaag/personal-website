"use client";

import {
	type Dispatch,
	type SetStateAction,
	useCallback,
	useState,
} from "react";
import type { UploadFolder } from "@/lib/photos";

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
				const newRefs: string[] = [];

				for (const file of Array.from(files)) {
					const formData = new FormData();
					formData.append("file", file);
					formData.append("folder", folder);
					formData.append("identifier", identifier);

					const response = await fetch("/api/photos/upload", {
						method: "POST",
						body: formData,
					});
					const payload = (await response.json()) as {
						photoRef?: string;
						error?: string;
					};

					if (!response.ok || !payload.photoRef) {
						throw new Error(payload.error || "Unified upload failed");
					}

					newRefs.push(payload.photoRef);
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
