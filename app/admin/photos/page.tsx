"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import PhotoUploader from "@/components/admin/PhotoUploader";
import { PhotoEditSheet } from "@/components/admin/photos/PhotoEditSheet";
import { PhotosDataTable } from "@/components/admin/photos/PhotosDataTable";
import {
	type AdminPhotoItem,
	type FeaturedFilter,
} from "@/components/admin/photos/types";
import type { PhotoVisibility } from "@/lib/photos";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export default function AdminPhotosPage() {
	const [photos, setPhotos] = useState<AdminPhotoItem[]>([]);
	const [uploadRefs, setUploadRefs] = useState<string[]>([]);
	const [loading, setLoading] = useState(true);
	const [visibilityFilter, setVisibilityFilter] = useState<
		PhotoVisibility | "all"
	>("all");
	const [featuredFilter, setFeaturedFilter] = useState<FeaturedFilter>("all");
	const [selectedPhoto, setSelectedPhoto] = useState<AdminPhotoItem | null>(
		null,
	);
	const [sheetOpen, setSheetOpen] = useState(false);
	const [deleteTarget, setDeleteTarget] = useState<AdminPhotoItem | null>(null);
	const [deleting, setDeleting] = useState(false);

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
			toast.error("Failed to load photos");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		void loadPhotos();
	}, [loadPhotos]);

	const filteredPhotos = useMemo(() => {
		return photos.filter((photo) => {
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
	}, [photos, visibilityFilter, featuredFilter]);

	const openEditor = useCallback((photo: AdminPhotoItem) => {
		setSelectedPhoto(photo);
		setSheetOpen(true);
	}, []);

	const handleDelete = useCallback(async () => {
		if (!deleteTarget) return;
		setDeleting(true);
		try {
			const response = await fetch(
				`/api/photos?id=${encodeURIComponent(deleteTarget.id)}`,
				{ method: "DELETE" },
			);
			if (!response.ok) {
				throw new Error("Failed to delete photo");
			}
			toast.success("Photo deleted");
			setDeleteTarget(null);
			if (selectedPhoto?.id === deleteTarget.id) {
				setSheetOpen(false);
				setSelectedPhoto(null);
			}
			await loadPhotos();
		} catch (error) {
			console.error(error);
			toast.error("Failed to delete photo");
		} finally {
			setDeleting(false);
		}
	}, [deleteTarget, loadPhotos, selectedPhoto?.id]);

	return (
		<main className="mx-auto max-w-6xl px-6 py-12">
			<h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
				Manage Photos
			</h1>
			<p className="mt-2 text-zinc-600 dark:text-zinc-400">
				Upload photos once, then edit metadata in the drawer. Click a row to
				edit.
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
					autoUpload={false}
					onError={() => toast.error("Upload failed")}
				/>
			</div>

			<div className="mt-5 grid gap-3 sm:grid-cols-2">
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

			<div className="mt-6">
				{loading ? (
					<p className="text-zinc-600 dark:text-zinc-400">Loading photos...</p>
				) : (
					<PhotosDataTable
						photos={filteredPhotos}
						onRowClick={openEditor}
						onDelete={setDeleteTarget}
					/>
				)}
			</div>

			<PhotoEditSheet
				photo={selectedPhoto}
				open={sheetOpen}
				onOpenChange={(open) => {
					setSheetOpen(open);
					if (!open) setSelectedPhoto(null);
				}}
				onSaved={loadPhotos}
			/>

			<AlertDialog
				open={deleteTarget !== null}
				onOpenChange={(open) => {
					if (!open && !deleting) setDeleteTarget(null);
				}}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Delete this photo?</AlertDialogTitle>
						<AlertDialogDescription>
							This removes it from the system and from the associated context
							where it is attached.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
						<AlertDialogAction
							disabled={deleting}
							onClick={(event) => {
								event.preventDefault();
								void handleDelete();
							}}
						>
							{deleting ? "Deleting..." : "Delete"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</main>
	);
}
