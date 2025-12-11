"use client";

import { useEffect, useId } from "react";
import usePhotoUpload, {
	type UsePhotoUploadOptions,
} from "@/hooks/usePhotoUpload";

interface PhotoUploaderProps extends UsePhotoUploadOptions {
	label?: string;
	inputId?: string;
	photos: string[];
	onChange?: (photos: string[]) => void;
	disabled?: boolean;
	onError?: (error: unknown) => void;
}

export default function PhotoUploader(props: PhotoUploaderProps) {
	const {
		label = "Photos (optional)",
		inputId,
		photos,
		onChange,
		disabled,
		onSuccess,
		onError,
		...uploadOptions
	} = props;

	const resolvedId = inputId ?? useId();

	const { photos: localPhotos, uploading, uploadPhotos, removePhoto, setPhotos } =
		usePhotoUpload({
			...uploadOptions,
			onSuccess,
		});

	useEffect(() => {
		setPhotos(photos);
	}, [photos, setPhotos]);

	useEffect(() => {
		onChange?.(localPhotos);
	}, [localPhotos, onChange]);

	const handleFiles = async (files: FileList | null) => {
		if (disabled) return;

		try {
			await uploadPhotos(files);
		} catch (error) {
			onError?.(error);
			if (!onError) {
				alert("Failed to upload photos");
			}
		}
	};

	return (
		<div>
			<label
				htmlFor={resolvedId}
				className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
			>
				{label}
			</label>
			<input
				id={resolvedId}
				type="file"
				accept="image/*"
				multiple
				disabled={disabled || uploading}
				onChange={(e) => handleFiles(e.target.files)}
				className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
			/>
			{uploading && (
				<p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
					Uploading...
				</p>
			)}
			{localPhotos.length > 0 && (
				<div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
					{localPhotos.map((photo) => (
						<div key={photo} className="relative">
							<img
								src={photo}
								alt={label}
								className="h-24 w-full rounded object-cover"
							/>
							<button
								type="button"
								onClick={() => removePhoto(photo)}
								className="absolute right-1 top-1 rounded-full bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600"
							>
								×
							</button>
						</div>
					))}
				</div>
			)}
		</div>
	);
}

