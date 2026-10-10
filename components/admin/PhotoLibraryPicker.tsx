"use client";

import { PhotoThumbnail } from "@/components/admin/PhotoDisplay";
import { CONTEXT_LABELS, contextLabel } from "@/components/admin/photos/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
import type { PhotoAssetListItem } from "@/lib/photo-assets-db";
import type { PhotoContextType, UploadFolder } from "@/lib/photos";
import { Images } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";

interface PhotoLibraryPickerProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Refs already attached to the current entry — shown as selected/disabled */
	alreadySelected?: string[];
	folder: UploadFolder;
	contextId: string;
	contextType?: PhotoContextType;
	onAttached: (photoRefs: string[]) => void;
}

export function PhotoLibraryPicker({
	open,
	onOpenChange,
	alreadySelected = [],
	folder,
	contextId,
	contextType,
	onAttached,
}: PhotoLibraryPickerProps) {
	const [photos, setPhotos] = useState<PhotoAssetListItem[]>([]);
	const [loading, setLoading] = useState(false);
	const [attaching, setAttaching] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [query, setQuery] = useState("");
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [contextFilter, setContextFilter] = useState<string>("all");

	const alreadySelectedSet = useMemo(
		() => new Set(alreadySelected),
		[alreadySelected],
	);

	const loadPhotos = useCallback(async () => {
		setLoading(true);
		setError(null);
		try {
			const response = await fetch("/api/photos?admin=true");
			if (!response.ok) {
				throw new Error("Failed to load photo library");
			}
			const data = (await response.json()) as PhotoAssetListItem[];
			setPhotos(data);
		} catch (err) {
			console.error(err);
			setError(err instanceof Error ? err.message : "Failed to load photos");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (!open) return;
		setSelectedIds(new Set());
		setQuery("");
		setContextFilter("all");
		void loadPhotos();
	}, [open, loadPhotos]);

	const filteredPhotos = useMemo(() => {
		const needle = query.trim().toLowerCase();
		if (!needle) return photos;
		return photos.filter((photo) => {
			const haystack = [
				photo.title,
				photo.caption,
				photo.locationLabel,
				photo.contextType ? contextLabel(photo.contextType) : "",
				photo.contextId,
				photo.visibility,
			]
				.filter(Boolean)
				.join(" ")
				.toLowerCase();
			return haystack.includes(needle);
		});
	}, [photos, query]);

	const togglePhoto = (photo: PhotoAssetListItem) => {
		if (alreadySelectedSet.has(photo.displayRef)) return;
		setSelectedIds((prev) => {
			const next = new Set(prev);
			if (next.has(photo.id)) next.delete(photo.id);
			else next.add(photo.id);
			return next;
		});
	};

	const handleAttach = async () => {
		if (selectedIds.size === 0 || !contextId) return;
		setAttaching(true);
		setError(null);
		try {
			const response = await fetch("/api/photos/attach", {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					photoIds: [...selectedIds],
					folder,
					contextType,
					contextId,
				}),
			});
			const payload = (await response.json()) as {
				photoRefs?: string[];
				error?: string;
			};
			if (!response.ok) {
				throw new Error(payload.error ?? "Failed to attach photos");
			}
			const refs = (payload.photoRefs ?? []).filter(
				(ref) => !alreadySelectedSet.has(ref),
			);
			if (refs.length > 0) {
				onAttached(refs);
			}
			onOpenChange(false);
		} catch (err) {
			console.error(err);
			setError(err instanceof Error ? err.message : "Failed to attach photos");
		} finally {
			setAttaching(false);
		}
	};

	const contextFilters = useMemo(() => {
		const counts = new Map<string, number>();
		for (const photo of photos) {
			const key = photo.contextType ?? "unassigned";
			counts.set(key, (counts.get(key) ?? 0) + 1);
		}
		return [...counts.entries()].sort((a, b) => b[1] - a[1]);
	}, [photos]);

	const visiblePhotos = useMemo(() => {
		if (contextFilter === "all") return filteredPhotos;
		if (contextFilter === "unassigned") {
			return filteredPhotos.filter((photo) => !photo.contextType);
		}
		return filteredPhotos.filter(
			(photo) => photo.contextType === contextFilter,
		);
	}, [filteredPhotos, contextFilter]);

	return (
		<Sheet open={open} onOpenChange={onOpenChange}>
			<SheetContent
				side="right"
				className="flex w-full flex-col gap-0 p-0 sm:max-w-2xl"
			>
				<SheetHeader className="border-b border-border">
					<SheetTitle>Choose from library</SheetTitle>
					<SheetDescription>
						Select existing photos to attach without re-uploading.
					</SheetDescription>
				</SheetHeader>

				<div className="space-y-3 border-b border-border p-4">
					<Input
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						placeholder="Search title, caption, location…"
						disabled={loading || attaching}
					/>
					<div className="flex flex-wrap gap-1.5">
						<button
							type="button"
							onClick={() => setContextFilter("all")}
							className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
								contextFilter === "all"
									? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
									: "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
							}`}
						>
							All ({photos.length})
						</button>
						{contextFilters.map(([key, count]) => (
							<button
								key={key}
								type="button"
								onClick={() => setContextFilter(key)}
								className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
									contextFilter === key
										? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
										: "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
								}`}
							>
								{key === "unassigned"
									? "Unassigned"
									: (CONTEXT_LABELS[key] ?? key)}{" "}
								({count})
							</button>
						))}
					</div>
				</div>

				<div className="min-h-0 flex-1 overflow-y-auto p-4">
					{loading && (
						<p className="text-sm text-zinc-600 dark:text-zinc-400">
							Loading library…
						</p>
					)}
					{!loading && error && (
						<p className="text-sm text-red-600 dark:text-red-400">{error}</p>
					)}
					{!loading && !error && visiblePhotos.length === 0 && (
						<p className="text-sm text-zinc-600 dark:text-zinc-400">
							No photos match your filters.
						</p>
					)}
					{!loading && visiblePhotos.length > 0 && (
						<div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
							{visiblePhotos.map((photo) => {
								const alreadyInEntry = alreadySelectedSet.has(photo.displayRef);
								const isSelected = selectedIds.has(photo.id);
								return (
									<button
										key={photo.id}
										type="button"
										disabled={alreadyInEntry || attaching}
										onClick={() => togglePhoto(photo)}
										className={`group relative overflow-hidden rounded-lg border text-left transition-all focus:outline-none focus:ring-2 focus:ring-zinc-500/30 disabled:cursor-default ${
											alreadyInEntry
												? "border-zinc-300 opacity-60 dark:border-zinc-700"
												: isSelected
													? "border-zinc-900 ring-2 ring-zinc-900/20 dark:border-zinc-100 dark:ring-zinc-100/20"
													: "border-zinc-200 hover:border-zinc-400 dark:border-zinc-800 dark:hover:border-zinc-600"
										}`}
									>
										<PhotoThumbnail
											photoRef={photo.thumbnailRef ?? photo.displayRef}
											alt={photo.title ?? photo.caption ?? "Library photo"}
											className="rounded-none"
										/>
										<div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-6">
											<p className="truncate text-[11px] font-medium text-white">
												{photo.title ||
													photo.locationLabel ||
													contextLabel(photo.contextType)}
											</p>
										</div>
										{(isSelected || alreadyInEntry) && (
											<span
												className={`absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white ${
													alreadyInEntry ? "bg-zinc-500" : "bg-zinc-900"
												}`}
											>
												{alreadyInEntry ? "Added" : "✓"}
											</span>
										)}
									</button>
								);
							})}
						</div>
					)}
				</div>

				<SheetFooter className="border-t border-border">
					{error && !loading && (
						<p className="text-sm text-red-600 dark:text-red-400 sm:col-span-2">
							{error}
						</p>
					)}
					<div className="flex w-full items-center justify-between gap-3">
						<p className="text-sm text-zinc-600 dark:text-zinc-400">
							{selectedIds.size === 0
								? "Select photos to attach"
								: `${selectedIds.size} selected`}
						</p>
						<div className="flex gap-2">
							<Button
								type="button"
								variant="outline"
								onClick={() => onOpenChange(false)}
								disabled={attaching}
							>
								Cancel
							</Button>
							<Button
								type="button"
								onClick={() => void handleAttach()}
								disabled={
									attaching || selectedIds.size === 0 || !contextId.trim()
								}
							>
								{attaching
									? "Attaching…"
									: `Add${selectedIds.size > 0 ? ` (${selectedIds.size})` : ""}`}
							</Button>
						</div>
					</div>
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}

interface PhotoLibraryPickerButtonProps {
	disabled?: boolean;
	onClick: () => void;
}

export function PhotoLibraryPickerButton({
	disabled,
	onClick,
}: PhotoLibraryPickerButtonProps) {
	return (
		<Button
			type="button"
			variant="outline"
			size="sm"
			disabled={disabled}
			onClick={onClick}
			className="gap-1.5"
		>
			<Images className="size-3.5" />
			Choose from library
		</Button>
	);
}
