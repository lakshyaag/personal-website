"use client";

import type { LibraryPhoto, Photo, PhotoList } from "@/shared/photos";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import PhotoField, { type DraftPhoto, photoIsReady } from "../PhotoField";
import { adminRequest } from "../client";
import { buttonClass, fieldClass } from "../styles";

const filters = {
	all: { label: "All", query: "" },
	gallery: { label: "Gallery", query: "featured=true" },
	public: { label: "Public", query: "visibility=public" },
	unused: { label: "Unused", query: "unused=true" },
} as const;
type Filter = keyof typeof filters;

function takenLabel(photo: Photo) {
	const value = photo.takenAt ?? photo.createdAt;
	return new Date(value).toLocaleDateString(undefined, {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

export default function PhotoLibrary() {
	const [filter, setFilter] = useState<Filter>("all");
	const [photos, setPhotos] = useState<LibraryPhoto[]>([]);
	const [cursor, setCursor] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [uploads, setUploads] = useState<DraftPhoto[]>([]);
	const [selected, setSelected] = useState<LibraryPhoto | null>(null);

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
				setError(
					reason instanceof Error ? reason.message : "Could not load photos",
				);
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

	function replace(photo: Photo) {
		setPhotos((items) =>
			items.map((item) =>
				item.id === photo.id ? { ...item, ...photo } : item,
			),
		);
		setSelected((current) =>
			current?.id === photo.id ? { ...current, ...photo } : current,
		);
	}
	function remove(id: string) {
		setPhotos((items) => items.filter((item) => item.id !== id));
		setSelected(null);
	}

	return (
		<main className="space-y-8 pb-16">
			<header className="flex items-end justify-between gap-4">
				<h1 className="text-3xl font-medium">Photos</h1>
				<Link className="text-sm underline" href="/admin">
					Admin
				</Link>
			</header>
			<section className="rounded-2xl border border-zinc-200 p-5 dark:border-zinc-800">
				<PhotoField photos={uploads} onChange={setUploads} disabled={false} />
			</section>
			<nav className="flex flex-wrap gap-2" aria-label="Filter photos">
				{(Object.keys(filters) as Filter[]).map((key) => (
					<button
						key={key}
						type="button"
						aria-pressed={filter === key}
						onClick={() => setFilter(key)}
						className={`${buttonClass} ${filter === key ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : ""}`}
					>
						{filters[key].label}
					</button>
				))}
			</nav>
			{error && (
				<p
					role="alert"
					className="rounded-lg border border-red-300 p-3 text-red-700 dark:text-red-300"
				>
					{error}
				</p>
			)}
			<ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
				{photos.map((photo) => (
					<li key={photo.id}>
						<button
							type="button"
							onClick={() => setSelected(photo)}
							className="block w-full overflow-hidden rounded-xl border border-zinc-200 text-left dark:border-zinc-800"
						>
							{/* Private images must not go through Next.js' public image optimization cache. */}
							<img
								src={`/api/admin/photos/${photo.id}/thumb`}
								alt={photo.title ?? photo.fileName}
								loading="lazy"
								className="aspect-square w-full object-cover"
							/>
							<span className="block space-y-1 p-2 text-xs text-zinc-500">
								<span className="block truncate text-sm text-zinc-900 dark:text-zinc-100">
									{photo.title ?? takenLabel(photo)}
								</span>
								<span className="block">
									{[
										photo.visibility === "public" ? "Public" : "Private",
										photo.featured && "Gallery",
										photo.links.length
											? [
													...new Set(photo.links.map((link) => link.context)),
												].join(", ")
											: "Unused",
									]
										.filter(Boolean)
										.join(" · ")}
								</span>
							</span>
						</button>
					</li>
				))}
			</ul>
			{loading ? (
				<output className="block text-zinc-500">Loading…</output>
			) : photos.length === 0 ? (
				<p className="text-zinc-500">No photos here yet.</p>
			) : (
				cursor && (
					<button
						type="button"
						className={buttonClass}
						onClick={() => void load(cursor)}
					>
						Load more
					</button>
				)
			)}
			{selected && (
				<PhotoDetails
					key={selected.id}
					photo={selected}
					onClose={() => setSelected(null)}
					onSaved={replace}
					onDeleted={remove}
				/>
			)}
		</main>
	);
}

function PhotoDetails({
	photo,
	onClose,
	onSaved,
	onDeleted,
}: {
	photo: LibraryPhoto;
	onClose: () => void;
	onSaved: (photo: Photo) => void;
	onDeleted: (id: string) => void;
}) {
	const [form, setForm] = useState({
		title: photo.title ?? "",
		caption: photo.caption ?? "",
		location: photo.location ?? "",
		visibility: photo.visibility,
		featured: photo.featured,
		showLocation: photo.showLocation,
	});
	const [busy, setBusy] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const hasGps = photo.latitude !== null && photo.longitude !== null;
	const camera = [photo.camera?.make, photo.camera?.model]
		.filter(Boolean)
		.join(" ");

	async function save(event: React.FormEvent) {
		event.preventDefault();
		setBusy(true);
		setError(null);
		try {
			onSaved(
				await adminRequest<Photo>(`photos/${photo.id}`, {
					method: "PATCH",
					body: JSON.stringify(form),
				}),
			);
			onClose();
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : "Could not save");
		} finally {
			setBusy(false);
		}
	}
	async function destroy() {
		if (!window.confirm("Delete this photo permanently?")) return;
		setBusy(true);
		setError(null);
		try {
			await adminRequest(`photos/${photo.id}`, { method: "DELETE" });
			onDeleted(photo.id);
		} catch (reason) {
			setError(reason instanceof Error ? reason.message : "Could not delete");
			setBusy(false);
		}
	}

	return (
		<dialog
			open
			aria-label="Photo details"
			className="fixed inset-0 z-50 m-0 flex h-full w-full items-center justify-center bg-black/60 p-4"
		>
			<form
				onSubmit={save}
				className="grid max-h-full w-full max-w-4xl gap-6 overflow-auto rounded-2xl bg-white p-5 sm:grid-cols-2 dark:bg-zinc-950"
			>
				<img
					src={`/api/admin/photos/${photo.id}/display`}
					alt={photo.title ?? photo.fileName}
					className="w-full rounded-xl object-contain"
				/>
				<fieldset disabled={busy} className="space-y-4">
					<p className="text-sm text-zinc-500">
						{[takenLabel(photo), camera].filter(Boolean).join(" · ")}
					</p>
					{(
						[
							["title", "Title"],
							["caption", "Caption"],
							["location", "Location"],
						] as const
					).map(([key, label]) => (
						<label key={key} className="block space-y-1">
							<span className="text-sm font-medium">{label}</span>
							<input
								value={form[key]}
								onChange={(event) =>
									setForm({ ...form, [key]: event.target.value })
								}
								className={fieldClass}
							/>
						</label>
					))}
					<label className="block space-y-1">
						<span className="text-sm font-medium">Visibility</span>
						<select
							value={form.visibility}
							onChange={(event) =>
								setForm({
									...form,
									visibility: event.target.value as Photo["visibility"],
								})
							}
							className={fieldClass}
						>
							<option value="private">Private</option>
							<option value="public">Public</option>
						</select>
					</label>
					<label className="flex items-center gap-2">
						<input
							type="checkbox"
							checked={form.featured}
							onChange={(event) =>
								setForm({ ...form, featured: event.target.checked })
							}
						/>
						<span>Show in gallery</span>
					</label>
					{hasGps && (
						<label className="flex items-center gap-2">
							<input
								type="checkbox"
								checked={form.showLocation}
								onChange={(event) =>
									setForm({ ...form, showLocation: event.target.checked })
								}
							/>
							<span>Show map location publicly</span>
						</label>
					)}
					{form.featured && form.visibility === "private" && (
						<p className="text-sm text-amber-700 dark:text-amber-400">
							Gallery photos must be public to appear on the site.
						</p>
					)}
					{photo.links.length > 0 && (
						<p className="text-sm text-zinc-500">
							Used in{" "}
							{photo.links
								.map((link) => `${link.context} ${link.contextId.slice(0, 8)}`)
								.join(", ")}
						</p>
					)}
					{error && (
						<p role="alert" className="text-sm text-red-600 dark:text-red-400">
							{error}
						</p>
					)}
					<div className="flex flex-wrap gap-3">
						<button
							type="submit"
							className="rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
						>
							Save
						</button>
						<button type="button" className={buttonClass} onClick={onClose}>
							Cancel
						</button>
						{photo.links.length === 0 && (
							<button
								type="button"
								className={`${buttonClass} text-red-600`}
								onClick={() => void destroy()}
							>
								Delete
							</button>
						)}
					</div>
				</fieldset>
			</form>
		</dialog>
	);
}
