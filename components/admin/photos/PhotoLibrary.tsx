"use client";

import { CheckboxInput, TextInput } from "@/components/admin/FormInputs";
import {
	AdminPage,
	EditorSheet,
	EmptyState,
	GroupHeader,
	ListStatus,
	Segmented,
	message,
	secondaryButton,
	useUndoDelete,
} from "@/components/admin/kit";
import { formatDate } from "@/lib/date-utils";
import type { LibraryPhoto, Photo, PhotoList } from "@/shared/photos";
import { Check, ImagePlus, MapPin, Star } from "lucide-react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import PhotoField, { type DraftPhoto, photoIsReady } from "../PhotoField";
import { adminRequest } from "../client";

const PhotoMap = dynamic(() => import("./PhotoMap"), { ssr: false });

/** Photos are filtered by where they're used; who can see them follows from that. */
const filters = {
	all: { label: "All", query: "" },
	gallery: { label: "Gallery", query: "featured=true" },
	visit: { label: "Airports", query: "context=visit" },
	food: { label: "Food", query: "context=food" },
	journal: { label: "Journal", query: "context=journal" },
	workout: { label: "Workouts", query: "context=workout" },
	unused: { label: "Not used", query: "unused=true" },
} as const;
type Filter = keyof typeof filters;
const filterOptions = (Object.keys(filters) as Filter[]).map((value) => ({
	value,
	label: filters[value].label,
}));

type PhotoLink = LibraryPhoto["links"][number];
const contextName: Record<PhotoLink["context"], string> = {
	journal: "Journal",
	food: "Food",
	workout: "Workout",
	visit: "Airport visit",
};
function linkHref(link: PhotoLink) {
	if (link.context === "journal")
		return `/admin/journal?edit=${link.contextId}`;
	if (link.context === "food") return `/admin/food?edit=${link.contextId}`;
	return link.context === "workout" ? "/admin/workouts" : "/admin/airports";
}
const linkText = (link: PhotoLink) =>
	[
		contextName[link.context],
		link.date &&
			formatDate(link.date, {
				month: "short",
				day: "numeric",
				year: "numeric",
			}),
		link.label?.replace(/\s+/g, " "),
	]
		.filter(Boolean)
		.join(" · ");

const onMap = (photo: LibraryPhoto) =>
	!photo.hiddenFromMap && photo.links.some((link) => link.context === "visit");
/** Where the public can see it, if anywhere. */
function audience(photo: LibraryPhoto) {
	const places = [
		photo.featured && "the gallery",
		onMap(photo) && "the airports map",
	]
		.filter(Boolean)
		.join(" and ");
	return places
		? `Public: shown on ${places}.`
		: "Private: only you can see it.";
}
const deletable = (photo: LibraryPhoto) => photo.links.length === 0;
const photosLabel = (count: number) =>
	`${count} ${count === 1 ? "photo" : "photos"}`;

/** Month groups by date taken; photos without one come last. */
function byMonth(photos: LibraryPhoto[]) {
	const groups: { key: string; label: string; photos: LibraryPhoto[] }[] = [];
	for (const photo of photos) {
		const key = photo.takenAt?.slice(0, 7) ?? "undated";
		let group = groups.at(-1);
		if (group?.key !== key) {
			group = {
				key,
				label:
					key === "undated"
						? "No date taken"
						: new Date(`${key}-15T12:00:00Z`).toLocaleDateString(undefined, {
								month: "long",
								year: "numeric",
							}),
				photos: [],
			};
			groups.push(group);
		}
		group.photos.push(photo);
	}
	return groups;
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
	// Only the latest load may update the list, so a slow earlier one (another filter) can't replace it.
	const latestLoad = useRef(0);

	const load = useCallback(
		async (next?: string | null) => {
			const request = ++latestLoad.current;
			setLoading(true);
			setError(null);
			try {
				const query = new URLSearchParams(filters[filter].query);
				query.set("limit", "120");
				if (next) query.set("cursor", next);
				const page = await adminRequest<PhotoList>(`photos?${query}`);
				if (request !== latestLoad.current) return;
				setPhotos((current) =>
					next ? [...current, ...page.photos] : page.photos,
				);
				setCursor(page.nextCursor);
			} catch (reason) {
				if (request === latestLoad.current)
					setError(message(reason, "Could not load photos"));
			} finally {
				if (request === latestLoad.current) setLoading(false);
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
	async function setFeatured(featured: boolean) {
		setBusy(true);
		const results = await Promise.allSettled(
			chosen.map((photo) =>
				adminRequest(`photos/${photo.id}`, {
					method: "PATCH",
					body: JSON.stringify({ featured }),
				}),
			),
		);
		const failed = results.filter((r) => r.status === "rejected").length;
		if (failed)
			toast.error(`${failed} of ${photosLabel(chosen.length)} weren't updated`);
		else
			toast.success(
				`${photosLabel(chosen.length)} ${featured ? "added to" : "removed from"} the gallery`,
			);
		setBusy(false);
		stopSelecting();
		void load();
	}
	function remove(items: LibraryPhoto[]) {
		removeMany(
			items.map((photo) => ({ id: photo.id, path: `photos/${photo.id}` })),
			`${photosLabel(items.length)} deleted`,
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
				label="Show photos"
				value={filter}
				options={filterOptions}
				onChange={(next) => {
					setFilter(next);
					setSelected(new Set());
				}}
			/>
			{filter === "unused" && !loading && visible.length > 0 && (
				<div className="flex items-center justify-between gap-3 rounded-xl bg-zinc-50 p-3 text-sm dark:bg-zinc-900">
					<p className="text-zinc-600 dark:text-zinc-400">
						Not in any entry or the gallery. Safe to delete.
					</p>
					<button
						type="button"
						className="shrink-0 font-medium text-red-600 dark:text-red-400"
						onClick={() => remove(visible)}
					>
						Delete all
					</button>
				</div>
			)}
			{byMonth(visible).map((group) => (
				<section key={group.key} className="space-y-2">
					<GroupHeader>{group.label}</GroupHeader>
					<ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
						{group.photos.map((photo) => {
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
										<span className="absolute bottom-1 left-1 flex gap-1">
											{photo.featured && (
												<span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white">
													<Star className="h-3.5 w-3.5 fill-current" />
													<span className="sr-only">In gallery</span>
												</span>
											)}
											{onMap(photo) && (
												<span className="flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white">
													<MapPin className="h-3.5 w-3.5" />
													<span className="sr-only">On airports map</span>
												</span>
											)}
										</span>
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
				</section>
			))}
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
								onClick={() => remove(chosen)}
							>
								Delete
							</button>
						</div>
						<div className="grid grid-cols-2 gap-2">
							<button
								type="button"
								className={secondaryButton}
								disabled={!chosen.length || busy}
								onClick={() => void setFeatured(true)}
							>
								Add to gallery
							</button>
							<button
								type="button"
								className={secondaryButton}
								disabled={!chosen.length || busy}
								onClick={() => void setFeatured(false)}
							>
								Remove from gallery
							</button>
						</div>
					</div>
				</div>
			)}
			{editing && (
				<PhotoEditor
					key={editing.id}
					photo={editing}
					onClose={() => setEditing(null)}
					onSaved={() => {
						setEditing(null);
						void load();
					}}
					onDelete={() => {
						setEditing(null);
						remove([editing]);
					}}
				/>
			)}
		</AdminPage>
	);
}

function exposure(camera: Photo["camera"]) {
	if (!camera) return null;
	const shutter =
		camera.exposureTime &&
		(camera.exposureTime < 1
			? `1/${Math.round(1 / camera.exposureTime)} s`
			: `${camera.exposureTime} s`);
	return (
		[
			camera.fNumber && `ƒ/${camera.fNumber}`,
			shutter,
			camera.iso && `ISO ${camera.iso}`,
		]
			.filter(Boolean)
			.join(" · ") || null
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
	onSaved: () => void;
	onDelete: () => void;
}) {
	const [initial] = useState(() => ({
		title: photo.title ?? "",
		caption: photo.caption ?? "",
		location: photo.location ?? "",
		featured: photo.featured,
		hiddenFromMap: photo.hiddenFromMap,
		showLocation: photo.showLocation,
	}));
	const [form, setForm] = useState(initial);
	const [saving, setSaving] = useState(false);
	const onVisit = photo.links.some((link) => link.context === "visit");
	const gps =
		photo.latitude !== null && photo.longitude !== null
			? { lat: photo.latitude, lon: photo.longitude }
			: null;
	const preview = { ...photo, ...form };
	const facts = [
		[
			"Taken",
			photo.takenAt &&
				new Date(photo.takenAt).toLocaleString(undefined, {
					dateStyle: "medium",
					timeStyle: "short",
				}),
		],
		[
			"Camera",
			[photo.camera?.make, photo.camera?.model].filter(Boolean).join(" ") ||
				null,
		],
		["Lens", photo.camera?.lens],
		["Exposure", exposure(photo.camera)],
		[
			"Size",
			[
				photo.width && photo.height && `${photo.width} × ${photo.height}`,
				`${(photo.byteSize / 1_000_000).toFixed(1)} MB`,
			]
				.filter(Boolean)
				.join(" · "),
		],
		["Uploaded", new Date(photo.createdAt).toLocaleDateString()],
	].filter((fact): fact is [string, string] => Boolean(fact[1]));

	async function save() {
		setSaving(true);
		try {
			await adminRequest<Photo>(`photos/${photo.id}`, {
				method: "PATCH",
				body: JSON.stringify(form),
			});
			onSaved();
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
			<p className="text-sm font-medium">{audience(preview)}</p>
			<CheckboxInput
				label="In the gallery"
				checked={form.featured}
				onChange={(featured) => setForm({ ...form, featured })}
			/>
			{onVisit && (
				<CheckboxInput
					label="Show on the airports map"
					checked={!form.hiddenFromMap}
					onChange={(shown) => setForm({ ...form, hiddenFromMap: !shown })}
				/>
			)}
			{photo.links.length > 0 && (
				<div className="space-y-1 text-sm">
					<span className="block font-medium text-zinc-700 dark:text-zinc-300">
						Used in
					</span>
					{photo.links.map((link) => (
						<Link
							key={`${link.context}-${link.contextId}`}
							href={linkHref(link)}
							className="block truncate underline"
						>
							{linkText(link)}
						</Link>
					))}
				</div>
			)}
			{gps && (
				<div className="space-y-1.5">
					<PhotoMap lat={gps.lat} lon={gps.lon} />
					<div className="flex items-center justify-between text-xs text-zinc-500">
						<span>
							{gps.lat.toFixed(5)}, {gps.lon.toFixed(5)}
						</span>
						<a
							className="underline"
							target="_blank"
							rel="noreferrer"
							href={`https://www.openstreetmap.org/?mlat=${gps.lat}&mlon=${gps.lon}#map=16/${gps.lat}/${gps.lon}`}
						>
							Open map
						</a>
					</div>
					{form.featured && (
						<CheckboxInput
							label="Show this location in the gallery"
							checked={form.showLocation}
							onChange={(showLocation) => setForm({ ...form, showLocation })}
						/>
					)}
				</div>
			)}
			<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
				{facts.map(([label, value]) => (
					<div key={label} className="contents">
						<dt className="text-zinc-500">{label}</dt>
						<dd className="min-w-0 truncate">{value}</dd>
					</div>
				))}
			</dl>
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
		</EditorSheet>
	);
}
