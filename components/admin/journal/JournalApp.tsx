"use client";

import { DateInput } from "@/components/admin/DateTimeInputs";
import { TextArea } from "@/components/admin/FormInputs";
import PhotoField, { type DraftPhoto } from "@/components/admin/PhotoField";
import { adminRequest } from "@/components/admin/client";
import {
	AdminPage,
	DayNav,
	EditorSheet,
	EmptyState,
	Fab,
	ListStatus,
	RecordCard,
	Segmented,
	message,
	secondaryButton,
	useUndoDelete,
} from "@/components/admin/kit";
import {
	LibraryPhotoGrid,
	discardUploads,
	photosReady,
	samePhotos,
	toDrafts,
} from "@/components/admin/library-photos";
import { formatDate } from "@/lib/date-utils";
import { localDate } from "@/shared/common";
import {
	type JournalEntry,
	entrySchema,
	journalListSchema,
	saveJournalSchema,
} from "@/shared/journal";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";

const views = [
	{ value: "all", label: "All" },
	{ value: "day", label: "Day" },
] as const;

/** Newest entries first, 20 at a time. */
function useJournal(date: string | null) {
	const [entries, setEntries] = useState<JournalEntry[]>([]);
	const [cursor, setCursor] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [version, setVersion] = useState(0);
	async function fetchPage(after: string | null, signal?: AbortSignal) {
		const query = new URLSearchParams({ limit: "20" });
		if (date) query.set("date", date);
		if (after) query.set("cursor", after);
		return journalListSchema.parse(
			await adminRequest(`journal?${query}`, { signal }),
		);
	}
	// biome-ignore lint/correctness/useExhaustiveDependencies: version triggers a refetch; fetchPage reads date.
	useEffect(() => {
		const controller = new AbortController();
		setLoading(true);
		setError(null);
		fetchPage(null, controller.signal)
			.then((page) => {
				setEntries(page.entries);
				setCursor(page.nextCursor);
			})
			.catch((reason) => {
				if (!controller.signal.aborted)
					setError(message(reason, "Could not load entries"));
			})
			.finally(() => {
				if (!controller.signal.aborted) setLoading(false);
			});
		return () => controller.abort();
	}, [date, version]);
	async function loadMore() {
		if (!cursor) return;
		setLoading(true);
		try {
			const page = await fetchPage(cursor);
			setEntries((current) => [
				...current,
				...page.entries.filter(
					(entry) => !current.some((e) => e.id === entry.id),
				),
			]);
			setCursor(page.nextCursor);
		} catch (reason) {
			setError(message(reason, "Could not load more entries"));
		} finally {
			setLoading(false);
		}
	}
	return {
		entries,
		cursor,
		loading,
		error,
		loadMore,
		reload: () => setVersion((value) => value + 1),
	};
}

export default function JournalApp({ editId }: { editId?: string }) {
	const router = useRouter();
	const today = localDate();
	const [view, setView] = useState<"all" | "day">("all");
	const [day, setDay] = useState(today);
	const journal = useJournal(view === "day" ? day : null);
	const { hidden, remove } = useUndoDelete();
	const [editor, setEditor] = useState<{ entry: JournalEntry | null } | null>(
		null,
	);

	useEffect(() => {
		if (!editId) return;
		adminRequest(`journal/${encodeURIComponent(editId)}`)
			.then((data) => setEditor({ entry: entrySchema.parse(data) }))
			.catch((error) => toast.error(message(error, "Entry not found")));
	}, [editId]);

	function close() {
		setEditor(null);
		if (editId) router.replace("/admin/journal");
	}
	const entries = journal.entries.filter((entry) => !hidden.has(entry.id));

	return (
		<AdminPage
			title="Journal"
			actions={
				<Segmented
					label="Show"
					value={view}
					options={views}
					onChange={setView}
				/>
			}
		>
			{view === "day" && <DayNav value={day} onChange={setDay} today={today} />}
			<div className="space-y-3" aria-label="Journal entries">
				{entries.map((entry) => (
					<RecordCard
						key={entry.id}
						label={`Edit entry from ${entry.date}`}
						onOpen={() => setEditor({ entry })}
						media={<LibraryPhotoGrid photos={entry.photos} />}
					>
						<div data-testid="journal-entry">
							<time dateTime={entry.date} className="text-xs text-zinc-500">
								{formatDate(entry.date)}
							</time>
							{entry.content && (
								<p className="mt-1 line-clamp-6 whitespace-pre-wrap break-words leading-relaxed">
									{entry.content}
								</p>
							)}
						</div>
					</RecordCard>
				))}
				{!journal.loading && !journal.error && entries.length === 0 && (
					<EmptyState>
						No entries{view === "day" ? ` on ${formatDate(day)}` : " yet"}.
					</EmptyState>
				)}
				<ListStatus
					loading={journal.loading}
					error={journal.error}
					onRetry={journal.reload}
				/>
				{journal.cursor && !journal.loading && (
					<button
						type="button"
						className={`w-full ${secondaryButton}`}
						onClick={() => void journal.loadMore()}
					>
						Load more
					</button>
				)}
			</div>
			<Fab label="New entry" onClick={() => setEditor({ entry: null })} />
			{editor && (
				<JournalEditor
					key={editor.entry?.id ?? "new"}
					entry={editor.entry}
					defaultDate={view === "day" ? day : today}
					onClose={close}
					onSaved={() => {
						close();
						journal.reload();
					}}
					onDelete={(entry) => {
						close();
						remove(
							entry.id,
							"Entry deleted",
							`journal/${entry.id}?expectedVersion=${entry.version}`,
						);
					}}
				/>
			)}
		</AdminPage>
	);
}

function JournalEditor({
	entry,
	defaultDate,
	onClose,
	onSaved,
	onDelete,
}: {
	entry: JournalEntry | null;
	defaultDate: string;
	onClose: () => void;
	onSaved: () => void;
	onDelete: (entry: JournalEntry) => void;
}) {
	const [id] = useState(() => entry?.id ?? crypto.randomUUID());
	const [initial] = useState(() => ({
		date: entry?.date ?? defaultDate,
		content: entry?.content ?? "",
	}));
	const [form, setForm] = useState(initial);
	const [photos, setPhotos] = useState<DraftPhoto[]>(() =>
		toDrafts(entry?.photos),
	);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const dirty =
		JSON.stringify(form) !== JSON.stringify(initial) ||
		!samePhotos(photos, entry?.photos);

	async function discardAnd(then: () => void) {
		await discardUploads(photos);
		then();
	}
	async function save() {
		setSaving(true);
		setError(null);
		try {
			const input = saveJournalSchema.parse({
				id,
				date: form.date,
				content: form.content,
				expectedVersion: entry?.version ?? 0,
				photoIds: photos.map((item) => item.id),
			});
			await adminRequest("journal", {
				method: "POST",
				body: JSON.stringify(input),
			});
			toast.success("Entry saved");
			onSaved();
		} catch (reason) {
			// Keep the draft open so nothing typed is lost (e.g. a newer version was saved elsewhere).
			setError(message(reason, "Could not save entry"));
			setSaving(false);
		}
	}

	return (
		<EditorSheet
			title={entry ? "Edit entry" : "New entry"}
			onClose={() => void discardAnd(onClose)}
			onSubmit={() => void save()}
			onDelete={
				entry ? () => void discardAnd(() => onDelete(entry)) : undefined
			}
			saving={saving}
			dirty={dirty}
			canSubmit={
				Boolean(form.date && (form.content.trim() || photos.length)) &&
				photosReady(photos)
			}
		>
			{error && (
				<p
					role="alert"
					className="rounded-lg border border-red-300 p-3 text-sm text-red-700 dark:border-red-800 dark:text-red-300"
				>
					{error} Your draft is still here.
				</p>
			)}
			<TextArea
				label="Your thoughts"
				value={form.content}
				onChange={(content) => setForm({ ...form, content })}
				rows={10}
				placeholder="What is on your mind?"
			/>
			<DateInput
				label="Entry date"
				value={form.date}
				onChange={(date) => setForm({ ...form, date })}
				required
			/>
			<PhotoField photos={photos} onChange={setPhotos} disabled={saving} />
		</EditorSheet>
	);
}
