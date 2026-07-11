"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { PhotoVisibility } from "@/lib/photos";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetFooter,
	SheetHeader,
	SheetTitle,
} from "@/components/ui/sheet";
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
import { PhotoThumbnailCell } from "./PhotoThumbnailCell";
import {
	type AdminPhotoItem,
	formatGps,
	formatTimestamp,
	normalizeOptionalText,
} from "./types";

type Draft = {
	title: string;
	caption: string;
	locationLabel: string;
	visibility: PhotoVisibility;
	galleryFeatured: boolean;
	gpsPublic: boolean;
};

function draftFromPhoto(photo: AdminPhotoItem): Draft {
	return {
		title: photo.title ?? "",
		caption: photo.caption ?? "",
		locationLabel: photo.locationLabel ?? "",
		visibility: photo.visibility,
		galleryFeatured: photo.galleryFeatured,
		gpsPublic: photo.gpsPublic,
	};
}

function isDirty(photo: AdminPhotoItem, draft: Draft): boolean {
	return (
		normalizeOptionalText(draft.title) !== (photo.title ?? null) ||
		normalizeOptionalText(draft.caption) !== (photo.caption ?? null) ||
		normalizeOptionalText(draft.locationLabel) !==
			(photo.locationLabel ?? null) ||
		draft.visibility !== photo.visibility ||
		draft.galleryFeatured !== photo.galleryFeatured ||
		draft.gpsPublic !== photo.gpsPublic
	);
}

interface PhotoEditSheetProps {
	photo: AdminPhotoItem | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSaved: () => Promise<void> | void;
}

export function PhotoEditSheet({
	photo,
	open,
	onOpenChange,
	onSaved,
}: PhotoEditSheetProps) {
	const [draft, setDraft] = useState<Draft | null>(null);
	const [saving, setSaving] = useState(false);
	const [discardOpen, setDiscardOpen] = useState(false);

	useEffect(() => {
		if (photo && open) {
			setDraft(draftFromPhoto(photo));
		}
		if (!open) {
			setDraft(null);
			setDiscardOpen(false);
		}
	}, [photo, open]);

	const dirty = useMemo(() => {
		if (!photo || !draft) return false;
		return isDirty(photo, draft);
	}, [photo, draft]);

	const hasGps =
		photo?.gpsLatitude !== null &&
		photo?.gpsLongitude !== null &&
		photo !== null;

	const requestClose = () => {
		if (dirty) {
			setDiscardOpen(true);
			return;
		}
		onOpenChange(false);
	};

	const handleSave = async () => {
		if (!photo || !draft || !dirty) return;
		setSaving(true);
		try {
			const response = await fetch("/api/photos", {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					id: photo.id,
					title: normalizeOptionalText(draft.title),
					caption: normalizeOptionalText(draft.caption),
					locationLabel: normalizeOptionalText(draft.locationLabel),
					visibility: draft.visibility,
					galleryFeatured: draft.galleryFeatured,
					gpsPublic: draft.gpsPublic,
				}),
			});
			if (!response.ok) {
				throw new Error("Failed to update photo");
			}
			toast.success("Photo updated");
			await onSaved();
			onOpenChange(false);
		} catch (error) {
			console.error(error);
			toast.error("Failed to update photo");
		} finally {
			setSaving(false);
		}
	};

	return (
		<>
			<Sheet
				open={open}
				onOpenChange={(next) => {
					if (!next) {
						if (dirty) {
							setDiscardOpen(true);
							return;
						}
						onOpenChange(false);
						return;
					}
					onOpenChange(true);
				}}
			>
				<SheetContent side="right" className="w-full sm:max-w-md">
					<SheetHeader>
						<SheetTitle>Edit photo</SheetTitle>
						<SheetDescription>
							Changes save only when you click Save.
						</SheetDescription>
					</SheetHeader>

					{photo && draft && (
						<div className="flex flex-1 flex-col gap-4 overflow-y-auto px-4 pb-2">
							<div className="flex items-start gap-3">
								<PhotoThumbnailCell
									photoRef={photo.thumbnailRef ?? photo.displayRef}
									alt={photo.title ?? "Photo"}
								/>
								<div className="min-w-0 space-y-1 text-xs text-muted-foreground">
									<div>Uploaded: {formatTimestamp(photo.createdAt)}</div>
									<div>Taken: {formatTimestamp(photo.takenAt)}</div>
									{photo.width && photo.height && (
										<div>
											{photo.width} × {photo.height}
										</div>
									)}
									{formatGps(photo) && <div>GPS: {formatGps(photo)}</div>}
								</div>
							</div>

							<div className="space-y-2">
								<Label htmlFor="photo-title">Title</Label>
								<Input
									id="photo-title"
									value={draft.title}
									onChange={(event) =>
										setDraft((current) =>
											current
												? { ...current, title: event.target.value }
												: current,
										)
									}
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="photo-location">Location</Label>
								<Input
									id="photo-location"
									value={draft.locationLabel}
									onChange={(event) =>
										setDraft((current) =>
											current
												? { ...current, locationLabel: event.target.value }
												: current,
										)
									}
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="photo-caption">Caption</Label>
								<Textarea
									id="photo-caption"
									rows={3}
									value={draft.caption}
									onChange={(event) =>
										setDraft((current) =>
											current
												? { ...current, caption: event.target.value }
												: current,
										)
									}
								/>
							</div>

							<div className="space-y-2">
								<Label htmlFor="photo-visibility">Visibility</Label>
								<select
									id="photo-visibility"
									value={draft.visibility}
									onChange={(event) =>
										setDraft((current) =>
											current
												? {
														...current,
														visibility: event.target
															.value as PhotoVisibility,
													}
												: current,
										)
									}
									className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
								>
									<option value="private">Private</option>
									<option value="unlisted">Unlisted</option>
									<option value="public">Public</option>
								</select>
							</div>

							<label className="flex items-center gap-2 text-sm">
								<Checkbox
									checked={draft.galleryFeatured}
									onCheckedChange={(checked) =>
										setDraft((current) =>
											current
												? {
														...current,
														galleryFeatured: checked === true,
													}
												: current,
										)
									}
								/>
								Feature in /photos
							</label>

							<label className="flex items-center gap-2 text-sm">
								<Checkbox
									checked={draft.gpsPublic}
									disabled={!hasGps}
									onCheckedChange={(checked) =>
										setDraft((current) =>
											current
												? { ...current, gpsPublic: checked === true }
												: current,
										)
									}
								/>
								Show GPS for public
							</label>
						</div>
					)}

					<SheetFooter>
						<Button variant="outline" onClick={requestClose} disabled={saving}>
							Cancel
						</Button>
						<Button onClick={() => void handleSave()} disabled={!dirty || saving}>
							{saving ? "Saving..." : "Save"}
						</Button>
					</SheetFooter>
				</SheetContent>
			</Sheet>

			<AlertDialog open={discardOpen} onOpenChange={setDiscardOpen}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Discard unsaved changes?</AlertDialogTitle>
						<AlertDialogDescription>
							You have unsaved edits. Closing will discard them.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Keep editing</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								setDiscardOpen(false);
								onOpenChange(false);
							}}
						>
							Discard
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
