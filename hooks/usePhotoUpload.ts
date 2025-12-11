"use client";

import {
	type Dispatch,
	type SetStateAction,
	useCallback,
	useState,
} from "react";

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
				const newUrls: string[] = [];
				for (const file of Array.from(files)) {
					const form = new FormData();
					form.append("file", file);
					form.append("folder", folder);
					form.append("identifier", identifier);

					const res = await fetch("/api/upload", {
						method: "POST",
						body: form,
					});

					if (!res.ok) throw new Error("Upload failed");

					const { url } = await res.json();
					newUrls.push(url);
				}

				setPhotos((prev) => [...prev, ...newUrls]);
				onSuccess?.(newUrls);
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

