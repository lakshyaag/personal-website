"use client";

import { CheckboxInput, TextInput } from "@/components/admin/FormInputs";
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
import { Check, Globe, ImagePlus, Star } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import PhotoField, { type DraftPhoto, photoIsReady } from "../PhotoField";
import { adminRequest } from "../client";

const filters = {
	all: { label: "All", query: "" },
	gallery: { label: "Gallery", query: "featured=true" },
	public: { label: "Public", query: "visibility=public" },
	private: { label: "Private", query: "visibility=private" },
	unused: { label: "Unused", query: "unused=true" },
} as const;
type Filter = keyof typeof filters;
const filterOptions = (Object.keys(filters) as Filter[]).map((value) => ({
	value,
	label: filters[value].label,
}));

/** One place a photo appears. Gallery photos are always public. */
type Status = "private" | "public" | "gallery";
const statusOptions = [
	{ value: "private", label: "Private" },
	{ value: "public", label: "Public" },
	{ value: "gallery", label: "Gallery" },
] as const;
const statusHint: Record<Status, string> = {
	private: "Only you can see it.",
	public: "Visible where it's used, like a visit on the airports map.",
	gallery: "In the public gallery and on the homepage.",
};
const statusOf = (photo: Photo): Status =>
	photo.featured
		? "gallery"
		: photo.visibility === "public"
			? "public"
			: "private";
const patchFor = (status: Status) => ({
	visibility: status === "private" ? "private" : "public",
	featured: status === "gallery",
});

const contextLabel = {
	journal: "Journal entry",
	food: "Food entry",
	workout: "Workout",
	visit: "Airport visit",
} as const;
function contextHref(link: LibraryPhoto["links"][number]) {
	if (link.context === "journal")
		return `/admin/journal?edit=${link.contextId}`;
	if (link.context === "food") return `/admin/food?edit=${link.contextId}`;
	return link.context === "workout" ? "/admin/workouts" : "/admin/airports";
}
const deletable = (photo: LibraryPhoto) => photo.links.length === 0;

const photosLabel = (count: number) =>
	`${count} ${count === 1 ? "photo" : "photos"}`;

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
	const [editing, setEditing] = useState<LibraryPhoto | null>(null);
	const [selecting, setSelecting] = useState(false);
	const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
	const [busy, setBusy] = useState(false);
	const { hidden, removeMany } = useUndoDelete();

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
	const chosen = visible.filter((photo) => selected.has(photo.id));
	function stopSelecting() {
		setSelecting(false);
		setSelected(new Set());
	}
	function toggle(id: string) {
		setSelected((current) => {
			const next = new Set(current);
			if (next.has(id)) next.delete(id);
			else next.add(id);
			return next;
		});
	}
	async function setStatus(status: Status) {
		setBusy(true);
		const results = await Promise.allSettled(
			chosen.map((photo) =>
				adminRequest(`photos/${photo.id}`, {
					method: "PATCH",
					body: JSON.stringify(patchFor(status)),
				}),
			),
		);
		const failed = results.filter((r) => r.status === "rejected").length;
		if (failed)
			toast.error(`${failed} of ${photosLabel(chosen.length)} weren't updated`);
		else toast.success(`${photosLabel(chosen.length)} updated`);
		setBusy(false);
		stopSelecting();
		void load();
	}
	function deleteChosen() {
		removeMany(
			chosen.map((photo) => ({ id: photo.id, path: `photos/${photo.id}` })),
			`${photosLabel(chosen.length)} deleted`,
		);
		stopSelecting();
	}

	return (
		<AdminPage
			title="Photos"
			actions={
				<>
					{!selecting && (
						<label
							htmlFor="library-upload"
							className={`flex cursor-pointer items-center gap-1.5 ${secondaryButton}`}
						>
							<ImagePlus className="h-4 w-4" />
							Upload
						</label>
					)}
					<button
						type="button"
						className={secondaryButton}
						onClick={() => (selecting ? stopSelecting() : setSelecting(true))}
					>
						{selecting ? "Done" : "Select"}
					</button>
				</>
			}
		>
			<PhotoField
				photos={uploads}
				onChange={setUploads}
				disabled={selecting}
				inputId="library-upload"
			/>
			<Segmented
				label="Filter photos"
				value={filter}
				options={filterOptions}
				onChange={(next) => {
					setFilter(next);
					setSelected(new Set());
				}}
			/>
			<ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
				{visible.map((photo) => {
					const status = statusOf(photo);
					const isSelected = selected.has(photo.id);
					return (
						<li key={photo.id}>
							<button
								type="button"
								aria-label={`${selecting ? "Select" : "Edit"} ${photo.title ?? photo.fileName}`}
								aria-pressed={selecting ? isSelected : undefined}
								onClick={() =>
									selecting ? toggle(photo.id) : setEditing(photo)
								}
								className="relative block w-full overflow-hidden rounded-lg"
							>
								{/* Private images must not go through Next.js' public image optimization cache. */}
								<img
									src={`/api/admin/photos/${photo.id}/thumb`}
									alt={photo.title ?? photo.fileName}
									loading="lazy"
									className={`aspect-square w-full bg-zinc-100 object-cover transition dark:bg-zinc-900 ${isSelected ? "scale-90 rounded-lg" : ""}`}
								/>
								{status !== "private" && (
									<span
										title={status === "gallery" ? "Gallery" : "Public"}
										className="absolute bottom-1 left-1 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
									>
										{status === "gallery" ? (
											<Star className="h-3.5 w-3.5 fill-current" />
										) : (
											<Globe className="h-3.5 w-3.5" />
										)}
										<span className="sr-only">
											{status === "gallery" ? "Gallery" : "Public"}
										</span>
									</span>
								)}
								{selecting && (
									<span
										className={`absolute top-1 right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-white ${isSelected ? "bg-blue-600" : "bg-black/30"}`}
									>
										{isSelected && <Check className="h-4 w-4 text-white" />}
									</span>
								)}
							</button>
						</li>
					);
				})}
			</ul>
			<ListStatus loading={loading} error={error} onRetry={() => void load()} />
			{!loading && !error && visible.length === 0 && (
				<EmptyState>
					{filter === "unused"
						? "Nothing unused: every photo is in an entry or the gallery."
						: "No photos here yet."}
				</EmptyState>
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
			{/* Room for the selection bar so it never covers the last row. */}
			{selecting && <div className="h-28" />}
			{selecting && (
				<div className="fixed inset-x-0 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-30 border-t border-zinc-200 bg-white/95 px-4 py-3 backdrop-blur sm:bottom-0 dark:border-zinc-800 dark:bg-zinc-950/95">
					<div className="mx-auto max-w-3xl space-y-2">
						<div className="flex items-center justify-between">
							<span className="text-sm font-medium">
								{photosLabel(chosen.length)} selected
							</span>
							<button
								type="button"
								className="px-2 py-1 text-sm font-medium text-red-600 disabled:opacity-40 dark:text-red-400"
								disabled={!chosen.length || busy || !chosen.every(deletable)}
								title={
									chosen.every(deletable)
										? undefined
										: "Photos used in entries are removed from the entry instead"
								}
								onClick={deleteChosen}
							>
								Delete
							</button>
						</div>
						<div className="grid grid-cols-3 gap-2">
							{statusOptions.map((option) => (
								<button
									key={option.value}
									type="button"
									className={secondaryButton}
									disabled={!chosen.length || busy}
									onClick={() => void setStatus(option.value)}
								>
									{option.label}
								</button>
							))}
						</div>
					</div>
				</div>
			)}
			{editing && (
				<PhotoEditor
					key={editing.id}
					photo={editing}
					onClose={() => setEditing(null)}
					onSaved={(photo) => {
						setPhotos((items) =>
							items.map((item) =>
								item.id === photo.id ? { ...item, ...photo } : item,
							),
						);
						setEditing(null);
					}}
					onDelete={() => {
						setEditing(null);
						removeMany(
							[{ id: editing.id, path: `photos/${editing.id}` }],
							"Photo deleted",
						);
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
		status: statusOf(photo),
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
		const { status, ...fields } = form;
		try {
			onSaved(
				await adminRequest<Photo>(`photos/${photo.id}`, {
					method: "PATCH",
					body: JSON.stringify({ ...fields, ...patchFor(status) }),
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
			onDelete={deletable(photo) ? onDelete : undefined}
			saving={saving}
			dirty={JSON.stringify(form) !== JSON.stringify(initial)}
			canSubmit
		>
			<a
				href={`/api/admin/photos/${photo.id}/display`}
				target="_blank"
				rel="noreferrer"
			>
				<img
					src={`/api/admin/photos/${photo.id}/display`}
					alt={photo.title ?? photo.fileName}
					className="max-h-[40dvh] w-full rounded-xl object-contain"
				/>
			</a>
			<p className="text-sm text-zinc-500">
				{[takenLabel(photo), camera].filter(Boolean).join(" · ")}
			</p>
			<div className="space-y-1.5">
				<span className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
					Who can see it
				</span>
				<Segmented
					label="Who can see it"
					value={form.status}
					options={statusOptions}
					onChange={(status) => setForm({ ...form, status })}
				/>
				<p className="text-sm text-zinc-500">{statusHint[form.status]}</p>
			</div>
			{photo.links.length > 0 && (
				<div className="space-y-1 text-sm">
					<span className="block font-medium text-zinc-700 dark:text-zinc-300">
						Used in
					</span>
					{photo.links.map((link) => (
						<Link
							key={`${link.context}-${link.contextId}`}
							href={contextHref(link)}
							className="block underline"
						>
							{contextLabel[link.context]}
						</Link>
					))}
				</div>
			)}
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
			{hasGps && form.status !== "private" && (
				<CheckboxInput
					label="Show map location publicly"
					checked={form.showLocation}
					onChange={(showLocation) => setForm({ ...form, showLocation })}
				/>
			)}
		</EditorSheet>
	);
}
