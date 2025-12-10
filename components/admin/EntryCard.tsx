import { ReactNode } from "react";
import { PhotoGrid } from "./PhotoGrid";
import { formatTime } from "@/lib/admin-utils";
import type { BaseEntry } from "@/hooks/useEntryManager";

interface EntryCardProps<T extends BaseEntry> {
	entry: T;
	onEdit: (entry: T) => void;
	onDelete: (id: string) => void;
	renderCustomFields?: (entry: T) => ReactNode;
	showTime?: boolean;
	photoAltText?: string;
}

export function EntryCard<T extends BaseEntry>({
	entry,
	onEdit,
	onDelete,
	renderCustomFields,
	showTime = true,
	photoAltText = "Entry photo",
}: EntryCardProps<T>) {
	return (
		<div className="rounded-lg border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
			<div className="mb-2 flex items-start justify-between">
				<div className="flex-1">
					{showTime && "createdAt" in entry && (
						<div className="text-xs text-zinc-500 dark:text-zinc-500 mb-2">
							{formatTime((entry as any).createdAt)}
						</div>
					)}

					{renderCustomFields && renderCustomFields(entry)}

					{entry.photos && entry.photos.length > 0 && (
						<div className="mt-3">
							<PhotoGrid photos={entry.photos} altText={photoAltText} />
						</div>
					)}
				</div>
				<div className="flex gap-2 ml-4">
					<button
						type="button"
						onClick={() => onEdit(entry)}
						className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
					>
						Edit
					</button>
					<button
						type="button"
						onClick={() => onDelete(entry.id)}
						className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
					>
						Delete
					</button>
				</div>
			</div>
		</div>
	);
}
