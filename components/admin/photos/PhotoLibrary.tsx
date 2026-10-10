"use client";

import {
	CheckboxInput,
	SelectInput,
	TextInput,
} from "@/components/admin/FormInputs";
import {
	AdminPage,
	EditorSheet,
	EmptyState,
	ListStatus,
	Segmented,
	message,
	secondaryButton,
	useUndoDelete,
} from "@/components/admin/kit";
import type { LibraryPhoto, Photo, PhotoList } from "@/shared/photos";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import PhotoField, { type DraftPhoto, photoIsReady } from "../PhotoField";
import { adminRequest } from "../client";

const filters = {
	all: { label: "All", query: "" },
	gallery: { label: "Gallery", query: "featured=true" },
	public: { label: "Public", query: "visibility=public" },
	unused: { label: "Unused", query: "unused=true" },
} as const;
type Filter = keyof typeof filters;
const filterOptions = (Object.keys(filters) as Filter[]).map((value) => ({
	value,
	label: filters[value].label,
}));

function takenLabel(photo: Photo) {
	return new Date(photo.takenAt ?? photo.createdAt).toLocaleDateString(
		undefined,
		{ year: "numeric", month: "short", day: "numeric" },
	);
}

export default function PhotoLibrary() {
	const [filter, setFilter] = useState<Filter>("all");
	const [photos, setPhotos] = useState<LibraryPhoto[]>([]);
	const [cursor, setCursor] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [uploads, setUploads] = useState<DraftPhoto[]>([]);
	const [selected, setSelected] = useState<LibraryPhoto | null>(null);
	const { hidden, remove } = useUndoDelete();

	const load = useCallback(
		async (next?: string | null) => {
			setLoading(true);
			setError(null);
			try {
				const query = new URLSearchParams(filters[filter].query);
				if (next) query.set("cursor", next);
				const page = await adminRequest<PhotoList>(`photos?${query}`);
				setPhotos((current) =>
					next ? [...current, ...page.photos] : page.photos,
				);
				setCursor(page.nextCursor);
			} catch (reason) {
				setError(message(reason, "Could not load photos"));
			} finally {
				setLoading(false);
			}
		},
		[filter],
	);
	useEffect(() => {
		void load();
	}, [load]);

	// Finished uploads join the library; the field only shows work in progress.
	useEffect(() => {
		if (uploads.length && uploads.every(photoIsReady)) {
			setUploads([]);
			void load();
		}
	}, [uploads, load]);

	const visible = photos.filter((photo) => !hidden.has(photo.id));
	return (
		<AdminPage title="Photos">
			<PhotoField photos={uploads} onChange={setUploads} disabled={false} />
			<Segmented
				label="Filter photos"
				value={filter}
				options={filterOptions}
				onChange={setFilter}
			/>
			<ul className="grid grid-cols-3 gap-2 sm:grid-cols-4">
				{visible.map((photo) => (
					<li key={photo.id}>
						<button
							type="button"
							aria-label={`Edit ${photo.title ?? photo.fileName}`}
							onClick={() => setSelected(photo)}
							className="relative block w-full overflow-hidden rounded-lg"
						>
							{/* Private images must not go through Next.js' public image optimization cache. */}
							<img
								src={`/api/admin/photos/${photo.id}/thumb`}
								alt={photo.title ?? photo.fileName}
								loading="lazy"
								className="aspect-square w-full object-cover"
							/>
							<span className="absolute inset-x-0 bottom-0 flex gap-1 p-1 text-[10px] font-medium">
								{photo.featured && (
									<span className="rounded bg-black/60 px-1 text-white">
										Gallery
									</span>
								)}
								{photo.visibility === "public" && (
									<span className="rounded bg-black/60 px-1 text-white">
										Public
									</span>
								)}
								{photo.links.length === 0 && (
									<span className="rounded bg-black/60 px-1 text-white">
										Unused
									</span>
								)}
							</span>
						</button>
					</li>
				))}
			</ul>
			<ListStatus loading={loading} error={error} onRetry={() => void load()} />
			{!loading && !error && visible.length === 0 && (
				<EmptyState>No photos here yet.</EmptyState>
			)}
			{!loading && cursor && (
				<button
					type="button"
					className={`w-full ${secondaryButton}`}
					onClick={() => void load(cursor)}
				>
					Load more
				</button>
			)}
			{selected && (
				<PhotoEditor
					key={selected.id}
					photo={selected}
					onClose={() => setSelected(null)}
					onSaved={(photo) => {
						setPhotos((items) =>
							items.map((item) =>
								item.id === photo.id ? { ...item, ...photo } : item,
							),
						);
						setSelected(null);
					}}
					onDelete={() => {
						setSelected(null);
						remove(selected.id, "Photo deleted", `photos/${selected.id}`);
					}}
				/>
			)}
		</AdminPage>
	);
}

function PhotoEditor({
	photo,
	onClose,
	onSaved,
	onDelete,
}: {
	photo: LibraryPhoto;
	onClose: () => void;
	onSaved: (photo: Photo) => void;
	onDelete: () => void;
}) {
	const [initial] = useState(() => ({
		title: photo.title ?? "",
		caption: photo.caption ?? "",
		location: photo.location ?? "",
		visibility: photo.visibility,
		featured: photo.featured,
		showLocation: photo.showLocation,
	}));
	const [form, setForm] = useState(initial);
	const [saving, setSaving] = useState(false);
	const hasGps = photo.latitude !== null && photo.longitude !== null;
	const camera = [photo.camera?.make, photo.camera?.model]
		.filter(Boolean)
		.join(" ");

	async function save() {
		setSaving(true);
		try {
			onSaved(
				await adminRequest<Photo>(`photos/${photo.id}`, {
					method: "PATCH",
					body: JSON.stringify(form),
				}),
			);
		} catch (error) {
			toast.error(message(error, "Could not save"));
			setSaving(false);
		}
	}

	return (
		<EditorSheet
			title="Photo"
			onClose={onClose}
			onSubmit={() => void save()}
			// Photos used by an entry are removed from that entry instead.
			onDelete={photo.links.length === 0 ? onDelete : undefined}
			saving={saving}
			dirty={JSON.stringify(form) !== JSON.stringify(initial)}
			canSubmit
		>
			<img
				src={`/api/admin/photos/${photo.id}/display`}
				alt={photo.title ?? photo.fileName}
				className="max-h-[40dvh] w-full rounded-xl object-contain"
			/>
			<p className="text-sm text-zinc-500">
				{[takenLabel(photo), camera].filter(Boolean).join(" · ")}
			</p>
			<TextInput
				label="Title"
				value={form.title}
				onChange={(title) => setForm({ ...form, title })}
			/>
			<TextInput
				label="Caption"
				value={form.caption}
				onChange={(caption) => setForm({ ...form, caption })}
			/>
			<TextInput
				label="Location"
				value={form.location}
				onChange={(location) => setForm({ ...form, location })}
			/>
			<SelectInput
				label="Visibility"
				value={form.visibility}
				onChange={(value) =>
					setForm({ ...form, visibility: value as Photo["visibility"] })
				}
				options={[
					{ value: "private", label: "Private" },
					{ value: "public", label: "Public" },
				]}
			/>
			<CheckboxInput
				label="Show in gallery"
				checked={form.featured}
				onChange={(featured) => setForm({ ...form, featured })}
			/>
			{hasGps && (
				<CheckboxInput
					label="Show map location publicly"
					checked={form.showLocation}
					onChange={(showLocation) => setForm({ ...form, showLocation })}
				/>
			)}
			{form.featured && form.visibility === "private" && (
				<p className="text-sm text-amber-700 dark:text-amber-400">
					Gallery photos must be public to appear on the site.
				</p>
			)}
			{photo.links.length > 0 && (
				<p className="text-sm text-zinc-500">
					Used in{" "}
					{[...new Set(photo.links.map((link) => link.context))].join(", ")}.
					Remove it from there to delete it.
				</p>
			)}
		</EditorSheet>
	);
}
