"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import usePhotoUpload, {
	type UsePhotoUploadOptions,
} from "@/hooks/usePhotoUpload";
import { PhotoThumbnail } from "@/components/admin/PhotoDisplay";

interface PhotoUploaderProps extends UsePhotoUploadOptions {
	label?: string;
	inputId?: string;
	photos: string[];
	onChange?: (photos: string[]) => void;
	disabled?: boolean;
	autoUpload?: boolean;
	onError?: (error: unknown) => void;
}

export default function PhotoUploader(props: PhotoUploaderProps) {
	const {
		label = "Photos (optional)",
		inputId,
		photos,
		onChange,
		disabled,
		autoUpload = true,
		onSuccess,
		onError,
		...uploadOptions
	} = props;

	const resolvedId = inputId ?? useId();
	const syncingFromProps = useRef(false);
	const [pendingFiles, setPendingFiles] = useState<File[]>([]);

	const pendingPreviews = useMemo(
		() => pendingFiles.map((file) => URL.createObjectURL(file)),
		[pendingFiles],
	);

	useEffect(() => {
		return () => {
			for (const url of pendingPreviews) URL.revokeObjectURL(url);
		};
	}, [pendingPreviews]);

	const {
		photos: localPhotos,
		uploading,
		uploadPhotos,
		removePhoto,
		setPhotos,
	} = usePhotoUpload({
		...uploadOptions,
		onSuccess,
	});

	useEffect(() => {
		syncingFromProps.current = true;
		setPhotos(photos);
	}, [photos, setPhotos]);

	useEffect(() => {
		if (syncingFromProps.current) {
			syncingFromProps.current = false;
			return;
		}
		onChange?.(localPhotos);
	}, [localPhotos, onChange]);

	const runUpload = async (files: FileList | File[] | null) => {
		if (disabled) return;

		try {
			await uploadPhotos(files);
			setPendingFiles([]);
		} catch (error) {
			onError?.(error);
			if (!onError) {
				alert("Failed to upload photos");
			}
		}
	};

	const handleFiles = (files: FileList | null) => {
		if (!files || files.length === 0) return;
		if (autoUpload) {
			void runUpload(files);
			return;
		}
		setPendingFiles(Array.from(files));
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

			{pendingFiles.length > 0 && (
				<div className="mt-3">
					<div className="grid max-w-3xl grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
						{pendingPreviews.map((url, index) => (
							<div
								key={`${pendingFiles[index]?.name}-${index}`}
								className="relative aspect-square overflow-hidden rounded"
							>
								<img
									src={url}
									alt={pendingFiles[index]?.name ?? "Selected photo"}
									className="h-full w-full object-cover"
								/>
							</div>
						))}
					</div>
					<div className="mt-3 flex gap-2">
						<button
							type="button"
							disabled={disabled || uploading}
							onClick={() => void runUpload(pendingFiles)}
							className="rounded bg-zinc-900 px-3 py-1.5 text-sm text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
						>
							{uploading ? "Uploading..." : "Upload selected"}
						</button>
						<button
							type="button"
							disabled={uploading}
							onClick={() => setPendingFiles([])}
							className="rounded border border-zinc-300 px-3 py-1.5 text-sm text-zinc-700 disabled:opacity-50 dark:border-zinc-700 dark:text-zinc-300"
						>
							Clear
						</button>
					</div>
				</div>
			)}

			{uploading && pendingFiles.length === 0 && (
				<p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
					Uploading...
				</p>
			)}

			{localPhotos.length > 0 && (
				<div className="mt-3 grid max-w-3xl grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
					{localPhotos.map((photo) => (
						<PhotoThumbnail
							key={photo}
							photoRef={photo}
							alt={label}
							showRemove
							onRemove={() => removePhoto(photo)}
						/>
					))}
				</div>
			)}
		</div>
	);
}
