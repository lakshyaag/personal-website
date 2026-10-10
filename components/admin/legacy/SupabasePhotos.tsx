"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import PhotoUploader from "@/components/admin/PhotoUploader";
import { PhotoEditSheet } from "@/components/admin/photos/PhotoEditSheet";
import { PhotosDataTable } from "@/components/admin/photos/PhotosDataTable";
import type { AdminPhotoItem } from "@/components/admin/photos/types";
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

export default function SupabasePhotos() {
	const [photos, setPhotos] = useState<AdminPhotoItem[]>([]);
	const [uploadRefs, setUploadRefs] = useState<string[]>([]);
	const [loading, setLoading] = useState(true);
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
					allowLibrary={false}
					onError={() => toast.error("Upload failed")}
				/>
			</div>

			<div className="mt-6">
				{loading ? (
					<p className="text-zinc-600 dark:text-zinc-400">Loading photos...</p>
				) : (
					<PhotosDataTable
						photos={photos}
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
