"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import PhotoUploader from "@/components/admin/PhotoUploader";
import { PhotoLightboxGrid } from "@/components/photos/PhotoLightboxGrid";
import type { PhotoVisibility } from "@/lib/photos";

interface AdminPhotoItem {
	id: string;
	visibility: PhotoVisibility;
	galleryFeatured: boolean;
	displayRef: string;
	thumbnailRef: string | null;
	createdAt: string;
	takenAt: string | null;
	width: number | null;
	height: number | null;
	title: string | null;
	caption: string | null;
	locationLabel: string | null;
	contextType: string | null;
	contextId: string | null;
}

type SortOption =
	| "created_desc"
	| "created_asc"
	| "taken_desc"
	| "taken_asc";
type FeaturedFilter = "all" | "featured" | "not_featured";
type PhotoPatch = Partial<{
	visibility: PhotoVisibility;
	galleryFeatured: boolean;
	title: string | null;
	caption: string | null;
	locationLabel: string | null;
}>;

const CONTEXT_LABELS: Record<string, string> = {
	airport_visit: "Airport Visits",
	food: "Food",
	fit: "Fits",
	gallery: "Gallery",
	journal: "Journal",
	workout: "Workouts",
};

const CONTEXT_ORDER = [
	"gallery",
	"airport_visit",
	"journal",
	"food",
	"workout",
	"fit",
	"unassigned",
];

function formatTimestamp(value: string | null): string {
	if (!value) return "Unknown";
	return new Date(value).toLocaleString("en-US", {
		month: "short",
		day: "numeric",
		year: "numeric",
		hour: "numeric",
		minute: "2-digit",
	});
}

function normalizeOptionalText(value: string): string | null {
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : null;
}

export default function AdminPhotosPage() {
	const [photos, setPhotos] = useState<AdminPhotoItem[]>([]);
	const [uploadRefs, setUploadRefs] = useState<string[]>([]);
	const [loading, setLoading] = useState(true);
	const [deletingPhotoId, setDeletingPhotoId] = useState<string | null>(null);
	const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
	const [sortBy, setSortBy] = useState<SortOption>("created_desc");
	const [visibilityFilter, setVisibilityFilter] = useState<
		PhotoVisibility | "all"
	>("all");
	const [featuredFilter, setFeaturedFilter] = useState<FeaturedFilter>("all");

	const loadPhotos = useCallback(async () => {
		setLoading(true);
		try {
			const response = await fetch("/api/photos?admin=true");
			if (!response.ok) {
				throw new Error("Failed to fetch admin photos");
			}
			const data = (await response.json()) as AdminPhotoItem[];
			setPhotos(data);
		} catch (error) {
			console.error(error);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadPhotos();
	}, [loadPhotos]);

	const updatePhoto = useCallback(
		async (id: string, patch: PhotoPatch) => {
			const response = await fetch("/api/photos", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ id, ...patch }),
			});
			if (!response.ok) {
				throw new Error("Failed to update photo");
			}
			await loadPhotos();
		},
		[loadPhotos],
	);

	const updateTextField = useCallback(
		(
			photo: AdminPhotoItem,
			field: "title" | "caption" | "locationLabel",
			value: string,
		) => {
			const nextValue = normalizeOptionalText(value);
			if ((photo[field] ?? null) === nextValue) return;
			void updatePhoto(photo.id, { [field]: nextValue });
		},
		[updatePhoto],
	);

	const deletePhoto = useCallback(
		async (id: string) => {
			const confirmed = window.confirm(
				"Delete this photo from the system? This also removes it from the associated context where it is attached.",
			);
			if (!confirmed) return;

			setDeletingPhotoId(id);
			try {
				const response = await fetch(`/api/photos?id=${encodeURIComponent(id)}`, {
					method: "DELETE",
				});
				if (!response.ok) {
					throw new Error("Failed to delete photo");
				}
				await loadPhotos();
			} catch (error) {
				console.error(error);
				alert("Failed to delete photo");
			} finally {
				setDeletingPhotoId(null);
			}
		},
		[loadPhotos],
	);

	const filteredAndSortedPhotos = useMemo(() => {
		const filtered = photos.filter((photo) => {
			if (visibilityFilter !== "all" && photo.visibility !== visibilityFilter) {
				return false;
			}
			if (featuredFilter === "featured" && !photo.galleryFeatured) {
				return false;
			}
			if (featuredFilter === "not_featured" && photo.galleryFeatured) {
				return false;
			}
			return true;
		});

		const sortValue = (photo: AdminPhotoItem) => {
			if (sortBy.startsWith("taken")) {
				return photo.takenAt ? new Date(photo.takenAt).getTime() : 0;
			}
			return new Date(photo.createdAt).getTime();
		};

		filtered.sort((a, b) => {
			const delta = sortValue(a) - sortValue(b);
			return sortBy.endsWith("asc") ? delta : -delta;
		});
		return filtered;
	}, [photos, sortBy, visibilityFilter, featuredFilter]);

	const groupedPhotos = useMemo(() => {
		const groups = new Map<string, AdminPhotoItem[]>();
		for (const photo of filteredAndSortedPhotos) {
			const key = photo.contextType ?? "unassigned";
			const list = groups.get(key) ?? [];
			list.push(photo);
			groups.set(key, list);
		}
		return CONTEXT_ORDER.filter((key) => groups.has(key)).map((key) => ({
			key,
			label:
				key === "unassigned" ? "Unassigned" : (CONTEXT_LABELS[key] ?? key),
			photos: groups.get(key) ?? [],
		}));
	}, [filteredAndSortedPhotos]);

	const toggleGroup = useCallback((key: string) => {
		setCollapsedGroups((previous) => {
			const next = new Set(previous);
			if (next.has(key)) {
				next.delete(key);
			} else {
				next.add(key);
			}
			return next;
		});
	}, []);

	return (
		<main className="mx-auto max-w-6xl px-6 py-12">
			<h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
				Manage Photos
			</h1>
			<p className="mt-2 text-zinc-600 dark:text-zinc-400">
				Upload photos once, then control visibility and gallery publishing.
			</p>

			<div className="mt-8 rounded-xl border border-zinc-200 bg-zinc-50/40 p-4 dark:border-zinc-800 dark:bg-zinc-900/30">
				<PhotoUploader
					label="Upload to unified gallery"
					photos={uploadRefs}
					onChange={setUploadRefs}
					onSuccess={() => {
						void loadPhotos();
					}}
					folder="gallery"
					identifier="gallery"
					onError={() => alert("Upload failed")}
				/>
			</div>

			<div className="mt-5 grid gap-3 sm:grid-cols-3">
				<label className="space-y-1">
					<span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
						Sort
					</span>
					<select
						value={sortBy}
						onChange={(event) => setSortBy(event.target.value as SortOption)}
						className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
					>
						<option value="created_desc">Newest uploaded</option>
						<option value="created_asc">Oldest uploaded</option>
						<option value="taken_desc">Newest taken date</option>
						<option value="taken_asc">Oldest taken date</option>
					</select>
				</label>
				<label className="space-y-1">
					<span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
						Visibility
					</span>
					<select
						value={visibilityFilter}
						onChange={(event) =>
							setVisibilityFilter(event.target.value as PhotoVisibility | "all")
						}
						className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
					>
						<option value="all">All</option>
						<option value="private">Private</option>
						<option value="unlisted">Unlisted</option>
						<option value="public">Public</option>
					</select>
				</label>
				<label className="space-y-1">
					<span className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
						Featured
					</span>
					<select
						value={featuredFilter}
						onChange={(event) =>
							setFeaturedFilter(event.target.value as FeaturedFilter)
						}
						className="w-full rounded border border-zinc-300 bg-white px-2 py-1.5 text-sm dark:border-zinc-700 dark:bg-zinc-900"
					>
						<option value="all">All</option>
						<option value="featured">Featured only</option>
						<option value="not_featured">Not featured</option>
					</select>
				</label>
			</div>

			{loading ? (
				<p className="mt-8 text-zinc-600 dark:text-zinc-400">
					Loading photos...
				</p>
			) : filteredAndSortedPhotos.length === 0 ? (
				<p className="mt-8 text-zinc-600 dark:text-zinc-400">
					No photos match the selected filters.
				</p>
			) : (
				<div className="mt-6 space-y-4">
					{groupedPhotos.map((group) => (
						<section
							key={group.key}
							className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/40"
						>
							<button
								type="button"
								onClick={() => toggleGroup(group.key)}
								className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/70"
							>
								<div className="flex items-center gap-3">
									<h2 className="text-base font-medium text-zinc-900 dark:text-zinc-100">
										{group.label}
									</h2>
									<span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
										{group.photos.length}
									</span>
								</div>
								<ChevronDown
									className={`h-4 w-4 text-zinc-500 transition-transform ${
										collapsedGroups.has(group.key) ? "" : "rotate-180"
									}`}
								/>
							</button>

							{!collapsedGroups.has(group.key) && (
								<div className="border-t border-zinc-200 p-4 dark:border-zinc-800">
									<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
										{group.photos.map((photo) => (
											<div
												key={photo.id}
												className="rounded-lg border border-zinc-200 bg-zinc-50/40 p-2.5 dark:border-zinc-800 dark:bg-zinc-900/40"
											>
												<PhotoLightboxGrid
													photos={[
														{
															ref: photo.displayRef,
															thumbnailRef: photo.thumbnailRef ?? photo.displayRef,
															alt: photo.title ?? "Uploaded photo",
															caption: (
																<div className="space-y-1">
																	<div className="font-medium text-zinc-100">
																		{photo.title ?? group.label}
																	</div>
																	{photo.caption && <div>{photo.caption}</div>}
																	<div className="text-xs text-zinc-400">
																		{photo.locationLabel ??
																			photo.contextId ??
																			group.label} · Taken {formatTimestamp(photo.takenAt)}
																	</div>
																</div>
															),
														},
													]}
													gridClassName="mb-2 grid grid-cols-1"
													thumbnailClassName="aspect-[4/3] w-full rounded"
												/>
												<div className="mb-2 space-y-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
													<div>Uploaded: {formatTimestamp(photo.createdAt)}</div>
													<div>Taken: {formatTimestamp(photo.takenAt)}</div>
													{photo.width && photo.height && (
														<div>
															{photo.width} × {photo.height}
														</div>
													)}
													{photo.contextId && <div>Context: {photo.contextId}</div>}
												</div>
												<div className="mb-2 space-y-1.5">
													<input
														defaultValue={photo.title ?? ""}
														onBlur={(event) =>
															updateTextField(photo, "title", event.target.value)
														}
														placeholder="Title"
														className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
													/>
													<input
														defaultValue={photo.locationLabel ?? ""}
														onBlur={(event) =>
															updateTextField(
																photo,
																"locationLabel",
																event.target.value,
															)
														}
														placeholder="Location label"
														className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
													/>
													<textarea
														defaultValue={photo.caption ?? ""}
														onBlur={(event) =>
															updateTextField(photo, "caption", event.target.value)
														}
														placeholder="Caption"
														rows={2}
														className="w-full resize-none rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
													/>
												</div>
												<div className="space-y-1.5">
													<select
														value={photo.visibility}
														onChange={(event) => {
															void updatePhoto(photo.id, {
																visibility: event.target.value as PhotoVisibility,
															});
														}}
														className="w-full rounded border border-zinc-300 bg-white px-2 py-1 text-xs dark:border-zinc-700 dark:bg-zinc-900"
													>
														<option value="private">Private</option>
														<option value="unlisted">Unlisted</option>
														<option value="public">Public</option>
													</select>
													<label className="flex items-center gap-2 text-xs text-zinc-700 dark:text-zinc-300">
														<input
															type="checkbox"
															checked={photo.galleryFeatured}
															onChange={(event) => {
																void updatePhoto(photo.id, {
																	galleryFeatured: event.target.checked,
																});
															}}
														/>
														Feature in `/photos`
													</label>
													<button
														type="button"
														disabled={deletingPhotoId === photo.id}
														onClick={() => void deletePhoto(photo.id)}
														className="w-full rounded border border-red-300 px-2 py-1 text-xs text-red-700 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/30"
													>
														{deletingPhotoId === photo.id
															? "Deleting..."
															: "Delete Photo"}
													</button>
												</div>
											</div>
										))}
									</div>
								</div>
							)}
						</section>
					))}
				</div>
			)}
		</main>
	);
}
