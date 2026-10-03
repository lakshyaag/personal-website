"use client";

import {
	type JournalEntry,
	type JournalList,
	entrySchema,
	journalListSchema,
	localDate,
	saveJournalSchema,
} from "@/shared/journal";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import PhotoEditor, { photoIsReady, type DraftPhoto } from "./PhotoEditor";
import { journalRequest } from "./client";

const fieldClass =
	"w-full rounded-lg border border-zinc-300 bg-transparent px-3 py-2 outline-none focus:ring-2 focus:ring-zinc-500 dark:border-zinc-700";
const buttonClass =
	"rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium disabled:opacity-50 dark:border-zinc-700";
interface Draft {
	id: string;
	date: string;
	timeZone: string;
	content: string;
	version: number;
}
function newDraft(): Draft {
	return {
		id: crypto.randomUUID(),
		date: localDate(),
		timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
		content: "",
		version: 0,
	};
}
export default function JournalApp({ editId }: { editId?: string }) {
	const router = useRouter();
	const [draft, setDraft] = useState<Draft | null>(null);
	const [photos, setPhotos] = useState<DraftPhoto[]>([]);
	const [baseline, setBaseline] = useState("");
	const [saving, setSaving] = useState(false);
	const [editingLoading, setEditingLoading] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [notice, setNotice] = useState<string | null>(null);
	const [filter, setFilter] = useState("all");
	const [filterDate, setFilterDate] = useState("");
	const [entries, setEntries] = useState<JournalEntry[]>([]);
	const [nextCursor, setNextCursor] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [listError, setListError] = useState<string | null>(null);
	const [refresh, setRefresh] = useState(0);
	const [deleting, setDeleting] = useState<string | null>(null);
	const listEpoch = useRef(0);
	const editEpoch = useRef(0);
	const loadedEditId = useRef<string | undefined | null>(null);
	const dirtyRef = useRef(false);
	const lastListQuery = useRef<string | null>(null);
	const queryDate = filter === "date" ? filterDate : undefined;
	const dirty = Boolean(
		draft &&
			JSON.stringify({ ...draft, photoIds: photos.map((item) => item.id) }) !==
				baseline,
	);
	const editorLocked = saving || editingLoading || Boolean(deleting);
	dirtyRef.current = dirty;
	const busy = editorLocked || photos.some((item) => item.uploading);
	const canSave = Boolean(
		draft &&
			!busy &&
			photos.every(photoIsReady) &&
			(draft.content.trim() || photos.length),
	);
	const installDraft = useCallback((entry?: JournalEntry) => {
		const value = entry
			? {
					id: entry.id,
					date: entry.date,
					timeZone: entry.timeZone,
					content: entry.content,
					version: entry.version,
				}
			: newDraft();
		const items: DraftPhoto[] =
			entry?.photos.map((photo) => ({
				id: photo.id,
				photo,
				existing: true,
				progress: 100,
				uploading: false,
			})) ?? [];
		setDraft(value);
		setPhotos(items);
		setBaseline(
			JSON.stringify({ ...value, photoIds: items.map((item) => item.id) }),
		);
		setError(null);
	}, []);
	useEffect(() => {
		installDraft();
		setFilterDate(localDate());
	}, [installDraft]);
	useEffect(() => {
		const previous = loadedEditId.current;
		if (previous === editId) return;
		if (
			previous !== null &&
			dirtyRef.current &&
			!window.confirm("Discard your unsaved journal changes?")
		) {
			router.replace(
				previous
					? `/admin/journal?edit=${encodeURIComponent(previous)}`
					: "/admin/journal",
			);
			return;
		}
		loadedEditId.current = editId;
		if (!editId) {
			setEditingLoading(false);
			if (previous) installDraft();
			return;
		}
		const controller = new AbortController();
		const epoch = ++editEpoch.current;
		let completed = false;
		setEditingLoading(true);
		void journalRequest<JournalEntry>(`journal/${encodeURIComponent(editId)}`, {
			signal: controller.signal,
		})
			.then((entry) => {
				if (epoch === editEpoch.current) installDraft(entrySchema.parse(entry));
			})
			.catch((reason) => {
				if (!controller.signal.aborted)
					setError(
						reason instanceof Error ? reason.message : "Could not load entry",
					);
			})
			.finally(() => {
				completed = true;
				if (!controller.signal.aborted && epoch === editEpoch.current)
					setEditingLoading(false);
			});
		return () => {
			controller.abort();
			if (!completed && loadedEditId.current === editId)
				loadedEditId.current = null;
		};
	}, [editId, installDraft, router]);
	useEffect(() => {
		if (!dirty) return;
		const unload = (event: BeforeUnloadEvent) => {
			event.preventDefault();
			event.returnValue = "";
		};
		const navigate = (event: MouseEvent) => {
			const anchor = (event.target as Element)?.closest?.("a");
			if (
				anchor &&
				anchor.target !== "_blank" &&
				new URL(anchor.href).pathname !== window.location.pathname &&
				!window.confirm("Discard your unsaved journal changes?")
			) {
				event.preventDefault();
				event.stopPropagation();
			}
		};
		window.addEventListener("beforeunload", unload);
		document.addEventListener("click", navigate, true);
		return () => {
			window.removeEventListener("beforeunload", unload);
			document.removeEventListener("click", navigate, true);
		};
	}, [dirty]);
	// biome-ignore lint/correctness/useExhaustiveDependencies: refresh deliberately triggers a new request after mutations or manual retries.
	useEffect(() => {
		const controller = new AbortController();
		const epoch = ++listEpoch.current;
		setLoading(true);
		setListError(null);
		const key = queryDate ?? "all";
		if (lastListQuery.current !== key) {
			setNextCursor(null);
			setEntries([]);
			lastListQuery.current = key;
		}
		if (queryDate === "") {
			setLoading(false);
			setListError("Select a date to filter entries.");
			return () => controller.abort();
		}
		const query = new URLSearchParams({ limit: "20" });
		if (queryDate) query.set("date", queryDate);
		void journalRequest<JournalList>(`journal?${query}`, {
			signal: controller.signal,
		})
			.then((data) => {
				if (epoch !== listEpoch.current) return;
				const result = journalListSchema.parse(data);
				setEntries(result.entries);
				setNextCursor(result.nextCursor);
			})
			.catch((reason) => {
				if (!controller.signal.aborted && epoch === listEpoch.current)
					setListError(
						reason instanceof Error ? reason.message : "Could not load entries",
					);
			})
			.finally(() => {
				if (epoch === listEpoch.current && !controller.signal.aborted)
					setLoading(false);
			});
		return () => {
			controller.abort();
		};
	}, [queryDate, refresh]);
	async function loadMore() {
		if (!nextCursor || loading) return;
		const epoch = listEpoch.current;
		setLoading(true);
		setListError(null);
		const query = new URLSearchParams({ cursor: nextCursor, limit: "20" });
		if (filter === "date") query.set("date", filterDate);
		try {
			const result = journalListSchema.parse(
				await journalRequest(`journal?${query}`),
			);
			if (epoch === listEpoch.current) {
				setEntries((old) => [
					...old,
					...result.entries.filter(
						(entry) => !old.some((existing) => existing.id === entry.id),
					),
				]);
				setNextCursor(result.nextCursor);
			}
		} catch (reason) {
			if (epoch === listEpoch.current)
				setListError(
					reason instanceof Error
						? reason.message
						: "Could not load more entries",
				);
		} finally {
			if (epoch === listEpoch.current) setLoading(false);
		}
	}
	async function discard() {
		if (
			busy ||
			(dirty && !window.confirm("Discard your unsaved journal changes?"))
		)
			return false;
		setEditingLoading(true);
		try {
			// Attached photos are never removed before the entry is saved.
			await Promise.all(
				photos
					.filter((item) => !item.existing && item.photo)
					.map((item) =>
						journalRequest(`photos/${item.id}`, { method: "DELETE" }).catch(
							() => undefined,
						),
					),
			);
		} finally {
			setEditingLoading(false);
		}
		return true;
	}
	async function reset() {
		if (!(await discard())) return;
		++editEpoch.current;
		installDraft();
		setNotice(null);
		loadedEditId.current = undefined;
		if (editId) router.replace("/admin/journal");
	}
	async function edit(entry: JournalEntry) {
		if (!(await discard())) return;
		++editEpoch.current;
		installDraft(entry);
		setNotice(null);
		window.scrollTo({ top: 0, behavior: "smooth" });
	}
	async function save(event: React.FormEvent) {
		event.preventDefault();
		if (!draft || !canSave) return;
		setSaving(true);
		setError(null);
		setNotice(null);
		try {
			const input = saveJournalSchema.parse({
				id: draft.id,
				date: draft.date,
				timeZone: draft.timeZone,
				content: draft.content,
				expectedVersion: draft.version,
				photoIds: photos.map((item) => item.id),
			});
			entrySchema.parse(
				await journalRequest("journal", {
					method: "POST",
					body: JSON.stringify(input),
				}),
			);
			installDraft();
			setNotice("Entry saved. Your photos are private.");
			setRefresh((value) => value + 1);
			loadedEditId.current = undefined;
			if (editId) router.replace("/admin/journal");
		} catch (reason) {
			setError(
				reason instanceof Error ? reason.message : "Could not save entry",
			);
		} finally {
			setSaving(false);
		}
	}
	async function remove(entry: JournalEntry) {
		if (
			busy ||
			deleting ||
			!window.confirm(
				draft?.id === entry.id && dirty
					? "Delete this entry, its photos, and your unsaved changes? This cannot be undone."
					: "Delete this entry and its photos? This cannot be undone.",
			)
		)
			return;
		// Do not discard uploaded draft photos until the version-checked deletion succeeds.
		setDeleting(entry.id);
		setListError(null);
		try {
			await journalRequest(
				`journal/${entry.id}?expectedVersion=${entry.version}`,
				{ method: "DELETE" },
			);
			if (draft?.id === entry.id) installDraft();
			setRefresh((value) => value + 1);
			setNotice("Entry deleted. Photo removal is scheduled.");
		} catch (reason) {
			setListError(
				reason instanceof Error ? reason.message : "Could not delete entry",
			);
		} finally {
			setDeleting(null);
		}
	}
	return (
		<main className="space-y-8 pb-16">
			<header className="flex items-end justify-between gap-4">
				<div className="space-y-2">
					<p className="text-sm text-zinc-500">
						Private · Cloudflare migration
					</p>
					<h1 className="text-3xl font-medium">Journal</h1>
					<p className="text-zinc-600 dark:text-zinc-400">
						A place for your thoughts, moments, and memories.
					</p>
				</div>
				<Link className="text-sm underline" href="/admin">
					Admin
				</Link>
			</header>
			{notice && (
				<output className="block rounded-xl border border-emerald-300 p-4 dark:border-emerald-800">
					{notice}
				</output>
			)}
			<form
				onSubmit={save}
				className="space-y-5 rounded-2xl border border-zinc-200 p-5 sm:p-7 dark:border-zinc-800"
			>
				<div className="flex items-center justify-between">
					<h2 className="text-xl font-medium">
						{draft?.version ? "Edit entry" : "New entry"}
					</h2>
					<span className="text-sm text-zinc-500">
						{dirty ? "Unsaved changes" : "Private journal"}
					</span>
				</div>
				{error && (
					<p
						role="alert"
						className="rounded-lg border border-red-300 p-3 text-red-700 dark:text-red-300"
					>
						{error}{" "}
						{draft?.version
							? "Your draft is still here. Copy it before reloading."
							: "Your draft is still here."}
					</p>
				)}
				{draft ? (
					<fieldset
						disabled={editorLocked}
						className="space-y-5 disabled:opacity-70"
					>
						<div className="grid gap-4 sm:grid-cols-2">
							<label className="space-y-2">
								<span className="block text-sm font-medium">Entry date</span>
								<input
									type="date"
									required
									aria-label="Entry date"
									value={draft.date}
									onChange={(event) =>
										setDraft({ ...draft, date: event.target.value })
									}
									className={fieldClass}
								/>
							</label>
							<label className="space-y-2">
								<span className="block text-sm font-medium">Time zone</span>
								<input
									required
									aria-label="Time zone"
									value={draft.timeZone}
									onChange={(event) =>
										setDraft({ ...draft, timeZone: event.target.value })
									}
									className={fieldClass}
								/>
								<span className="text-sm text-zinc-500">
									The date stays on the day you selected.
								</span>
							</label>
						</div>
						<label className="block space-y-2">
							<span className="text-sm font-medium">Your thoughts</span>
							<textarea
								aria-label="Your thoughts"
								rows={8}
								maxLength={100000}
								value={draft.content}
								onChange={(event) =>
									setDraft({ ...draft, content: event.target.value })
								}
								className={fieldClass}
								placeholder="What is on your mind?"
							/>
						</label>
					</fieldset>
				) : (
					<output>Preparing your journal…</output>
				)}
				{draft && (
					<PhotoEditor
						entryId={draft.id}
						photos={photos}
						onChange={setPhotos}
						disabled={editorLocked}
					/>
				)}
				<div className="flex flex-wrap items-center gap-3">
					<button
						disabled={!canSave}
						type="submit"
						className="rounded-lg bg-zinc-900 px-5 py-2.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-950"
					>
						{saving
							? "Saving…"
							: draft?.version
								? "Update entry"
								: "Save entry"}
					</button>
					<button
						type="button"
						className={buttonClass}
						disabled={busy}
						onClick={() => void reset()}
					>
						Discard draft
					</button>
					{photos.some((item) => !photoIsReady(item)) && (
						<span className="text-sm text-zinc-500">
							Wait for photos, retry them, or remove them before saving.
						</span>
					)}
				</div>
			</form>
			<section className="space-y-4" aria-label="Journal entries">
				<div className="flex flex-wrap items-center justify-between gap-3">
					<h2 className="text-xl font-medium">Entries</h2>
					<div className="flex items-center gap-2">
						<label className="sr-only" htmlFor="entry-filter">
							Filter entries
						</label>
						<select
							id="entry-filter"
							value={filter}
							onChange={(event) => setFilter(event.target.value)}
							className={buttonClass}
						>
							<option value="all">All dates</option>
							<option value="date">Specific date</option>
						</select>
						{filter === "date" && (
							<input
								aria-label="Filter date"
								type="date"
								value={filterDate}
								onChange={(event) => setFilterDate(event.target.value)}
								className={buttonClass}
							/>
						)}
						<button
							type="button"
							className={buttonClass}
							disabled={loading}
							onClick={() => setRefresh((value) => value + 1)}
						>
							Refresh
						</button>
					</div>
				</div>
				{listError && (
					<div role="alert" className="rounded-xl border border-red-300 p-4">
						<p>{listError}</p>
						<button
							className="mt-2 underline"
							type="button"
							onClick={() => setRefresh((value) => value + 1)}
						>
							Retry loading entries
						</button>
					</div>
				)}
				{loading && (
					<output className="block py-4 text-zinc-500">Loading entries…</output>
				)}
				{!loading && !listError && entries.length === 0 && (
					<p className="rounded-xl border border-dashed border-zinc-300 p-8 text-center text-zinc-500 dark:border-zinc-700">
						No entries yet{filter === "date" ? " for this date" : ""}. Write
						your first one above.
					</p>
				)}
				{entries.map((entry) => (
					<article
						key={entry.id}
						data-testid="journal-entry"
						className="space-y-4 rounded-xl border border-zinc-200 p-5 dark:border-zinc-800"
					>
						<div className="flex flex-wrap items-center justify-between gap-3">
							<div>
								<h3 className="font-medium">
									<time dateTime={entry.date}>{entry.date}</time>
								</h3>
								<p className="text-sm text-zinc-500">
									{entry.timeZone} · version {entry.version}
								</p>
							</div>
							<div className="flex gap-3">
								<button
									type="button"
									className={buttonClass}
									disabled={busy}
									onClick={() => void edit(entry)}
								>
									Edit
								</button>
								<button
									type="button"
									className={buttonClass}
									disabled={busy || Boolean(deleting)}
									onClick={() => void remove(entry)}
								>
									{deleting === entry.id ? "Deleting…" : "Delete"}
								</button>
							</div>
						</div>
						{entry.content && (
							<p className="whitespace-pre-wrap break-words leading-relaxed">
								{entry.content}
							</p>
						)}
						{entry.photos.length > 0 && (
							<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
								{entry.photos.map((photo) => (
									<img
										key={photo.id}
										src={`/api/migration/photos/${photo.id}/display`}
										alt={photo.fileName}
										loading="lazy"
										className="aspect-square w-full rounded-lg object-cover"
									/>
								))}
							</div>
						)}
					</article>
				))}
				{nextCursor && (
					<button
						type="button"
						className={buttonClass}
						disabled={loading}
						onClick={() => void loadMore()}
					>
						Load more entries
					</button>
				)}
			</section>
		</main>
	);
}
