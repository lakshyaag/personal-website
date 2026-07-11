"use client";

import {
	type Dispatch,
	type SetStateAction,
	useCallback,
	useState,
} from "react";
import type { UploadFolder } from "@/lib/photos";
import { createClient } from "@/lib/supabase-client";

export interface UsePhotoUploadOptions {
	folder: UploadFolder;
	identifier: string;
	onSuccess?: (urls: string[]) => void;
}

export interface UsePhotoUploadReturn {
	photos: string[];
	uploading: boolean;
	uploadPhotos: (files: FileList | File[] | null) => Promise<void>;
	removePhoto: (url: string) => void;
	setPhotos: Dispatch<SetStateAction<string[]>>;
	clearPhotos: () => void;
}

interface PreparedUpload {
	photoId: string;
	originalPath: string;
	token: string;
}

interface FinalizedUpload {
	photoRef: string;
}

async function parseApiResponse<T>(response: Response): Promise<T> {
	const contentType = response.headers.get("content-type") ?? "";
	const payload = contentType.includes("application/json")
		? ((await response.json()) as unknown)
		: await response.text();

	if (!response.ok) {
		const message =
			typeof payload === "object" &&
			payload !== null &&
			"error" in payload &&
			typeof payload.error === "string"
				? payload.error
				: typeof payload === "string" && payload.trim()
					? payload.trim()
					: `Upload failed with status ${response.status}`;
		throw new Error(message);
	}

	return payload as T;
}

function usePhotoUpload(
	options: UsePhotoUploadOptions,
): UsePhotoUploadReturn {
	const { folder, identifier, onSuccess } = options;
	const [photos, setPhotos] = useState<string[]>([]);
	const [uploading, setUploading] = useState(false);

	const uploadPhotos = useCallback(
		async (files: FileList | File[] | null) => {
			if (!files || files.length === 0) return;
			if (!identifier) {
				throw new Error("Missing upload identifier");
			}

			setUploading(true);
			try {
				const newRefs: string[] = [];
				const supabase = createClient();

				for (const file of Array.from(files)) {
					const prepareResponse = await fetch("/api/photos/upload", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({
							action: "prepare",
							folder,
							identifier,
							fileName: file.name,
							fileSize: file.size,
							fileType: file.type,
						}),
					});
					const prepared =
						await parseApiResponse<PreparedUpload>(prepareResponse);
					if (!prepared.photoId || !prepared.originalPath || !prepared.token) {
						throw new Error("Invalid upload target");
					}

					const { error: uploadError } = await supabase.storage
						.from("photo-originals")
						.uploadToSignedUrl(prepared.originalPath, prepared.token, file);
					if (uploadError) {
						throw new Error(uploadError.message);
					}

					const finalizeResponse = await fetch("/api/photos/upload", {
						method: "POST",
						headers: { "content-type": "application/json" },
						body: JSON.stringify({
							action: "finalize",
							folder,
							identifier,
							photoId: prepared.photoId,
							originalPath: prepared.originalPath,
						}),
					});
					const finalized =
						await parseApiResponse<FinalizedUpload>(finalizeResponse);
					if (!finalized.photoRef) {
						throw new Error("Invalid finalized upload");
					}

					newRefs.push(finalized.photoRef);
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
