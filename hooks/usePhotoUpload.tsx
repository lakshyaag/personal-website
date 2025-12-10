import { useState } from "react";
import { toast } from "sonner";

export interface UsePhotoUploadOptions {
	folder: string;
	onUploadComplete?: (urls: string[]) => void;
}

export function usePhotoUpload({ folder, onUploadComplete }: UsePhotoUploadOptions) {
	const [uploading, setUploading] = useState(false);

	async function uploadPhotos(files: FileList | null, identifier: string): Promise<string[]> {
		if (!files || files.length === 0) return [];

		setUploading(true);
		try {
			const urls: string[] = [];
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
				urls.push(url);
			}

			toast.success(`${urls.length} photo(s) uploaded successfully`);
			onUploadComplete?.(urls);
			return urls;
		} catch (err) {
			console.error("Upload error:", err);
			toast.error("Failed to upload photos");
			return [];
		} finally {
			setUploading(false);
		}
	}

	return { uploadPhotos, uploading };
}
