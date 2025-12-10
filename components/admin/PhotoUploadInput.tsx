import { PhotoGrid } from "./PhotoGrid";

interface PhotoUploadInputProps {
	id: string;
	label?: string;
	photos: string[];
	uploading: boolean;
	onUpload: (files: FileList | null) => void;
	onRemove: (photoUrl: string) => void;
	previewColumns?: number;
	previewHeight?: string;
}

export function PhotoUploadInput({
	id,
	label = "Photos (optional)",
	photos,
	uploading,
	onUpload,
	onRemove,
	previewColumns = 4,
	previewHeight = "h-24",
}: PhotoUploadInputProps) {
	return (
		<div>
			<label
				htmlFor={id}
				className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
			>
				{label}
			</label>
			<input
				id={id}
				type="file"
				accept="image/*"
				multiple
				onChange={(e) => onUpload(e.target.files)}
				disabled={uploading}
				className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
			/>
			{uploading && (
				<p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
					Uploading...
				</p>
			)}
			{photos.length > 0 && (
				<div className="mt-2">
					<PhotoGrid
						photos={photos}
						editable={true}
						onRemove={onRemove}
						columns={previewColumns}
					/>
				</div>
			)}
		</div>
	);
}
