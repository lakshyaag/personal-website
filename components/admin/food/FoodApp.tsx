"use client";

import { DateTimeInput } from "@/components/admin/DateTimeInputs";
import { FoodDashboard } from "@/components/admin/FoodDashboard";
import { TextArea } from "@/components/admin/FormInputs";
import PhotoField, { type DraftPhoto } from "@/components/admin/PhotoField";
import { adminRequest, groupBy } from "@/components/admin/client";
import {
	AdminPage,
	DayNav,
	EditorSheet,
	EmptyState,
	Fab,
	GroupHeader,
	ListStatus,
	RecordCard,
	Segmented,
	message,
	secondaryButton,
	useAdminList,
	useUndoDelete,
} from "@/components/admin/kit";
import {
	LibraryPhotoGrid,
	discardUploads,
	photosReady,
	samePhotos,
	toDrafts,
} from "@/components/admin/library-photos";
import { formatDate, formatTime } from "@/lib/date-utils";
import { localDate } from "@/shared/common";
import { type FoodEntry, foodListSchema } from "@/shared/food";
import { Loader2, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const parse = (data: unknown) => foodListSchema.parse(data).entries;
const currentTime = () => new Date().toTimeString().slice(0, 5);
const timeOf = (iso: string) => new Date(iso).toTimeString().slice(0, 5);
const views = [
	{ value: "day", label: "Day" },
	{ value: "all", label: "All" },
] as const;

function Macros({ entry }: { entry: FoodEntry }) {
	if (!entry.aiFoodName) return null;
	return (
		<div className="mt-2 flex flex-wrap gap-1.5 text-xs">
			<span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700 dark:bg-green-900/30 dark:text-green-400">
				{entry.aiCalories} kcal
			</span>
			<span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
				P {entry.aiProteinG}g
			</span>
			<span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
				C {entry.aiCarbsG}g
			</span>
			<span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
				F {entry.aiFatG}g
			</span>
		</div>
	);
}

export default function FoodApp({ editId }: { editId?: string }) {
	const router = useRouter();
	const today = localDate();
	const [view, setView] = useState<"day" | "all">("day");
	const [day, setDay] = useState(today);
	const list = useAdminList(
		view === "day" ? `food?date=${day}` : "food",
		parse,
	);
	const { hidden, remove } = useUndoDelete();
	const [editor, setEditor] = useState<{ entry: FoodEntry | null } | null>(
		null,
	);
	const refresh = useRef<ReturnType<typeof setTimeout>>(undefined);
	useEffect(() => () => clearTimeout(refresh.current), []);

	useEffect(() => {
		if (!editId) return;
		adminRequest<FoodEntry>(`food/${editId}`)
			.then((entry) => {
				setDay(entry.date);
				setEditor({ entry });
			})
			.catch((error) => toast.error(message(error, "Entry not found")));
	}, [editId]);

	function close() {
		setEditor(null);
		if (editId) router.replace("/admin/food");
	}
	const entries = list.items.filter((entry) => !hidden.has(entry.id));
	const card = (entry: FoodEntry) => (
		<RecordCard
			key={entry.id}
			label={`Edit ${entry.aiFoodName ?? "food entry"}`}
			onOpen={() => setEditor({ entry })}
			media={<LibraryPhotoGrid photos={entry.photos} />}
		>
			<div className="flex items-center gap-2 text-xs text-zinc-500">
				<span>{formatTime(entry.eatenAt)}</span>
				{entry.aiFoodName && (
					<span className="flex items-center gap-0.5 text-green-600 dark:text-green-400">
						<Sparkles className="h-3 w-3" />
						{entry.aiFoodName}
					</span>
				)}
			</div>
			{entry.description && (
				<p className="mt-1 line-clamp-3 whitespace-pre-wrap">
					{entry.description}
				</p>
			)}
			<Macros entry={entry} />
		</RecordCard>
	);

	return (
		<AdminPage
			title="Food"
			actions={
				<Segmented
					label="View"
					value={view}
					options={views}
					onChange={setView}
				/>
			}
		>
			{view === "day" && <DayNav value={day} onChange={setDay} today={today} />}
			<ListStatus
				loading={list.loading}
				error={list.error}
				onRetry={list.reload}
			/>
			{!list.loading &&
				!list.error &&
				(view === "day" ? (
					<div className="space-y-3">
						<FoodDashboard entries={entries} />
						{entries.map(card)}
						{entries.length === 0 && (
							<EmptyState>Nothing logged on {formatDate(day)}.</EmptyState>
						)}
					</div>
				) : (
					<div className="space-y-3">
						{entries.length === 0 && (
							<EmptyState>Nothing logged yet.</EmptyState>
						)}
						{Object.entries(groupBy(entries, (entry) => entry.date))
							.sort(([a], [b]) => b.localeCompare(a))
							.map(([date, group]) => (
								<section key={date} className="space-y-3">
									<div className="flex flex-wrap items-center justify-between gap-2">
										<GroupHeader>{formatDate(date)}</GroupHeader>
										<FoodDashboard entries={group} compact />
									</div>
									{group.map(card)}
								</section>
							))}
					</div>
				))}
			<Fab label="Log food" onClick={() => setEditor({ entry: null })} />
			{editor && (
				<FoodEditor
					key={editor.entry?.id ?? "new"}
					entry={editor.entry}
					defaultDate={view === "day" ? day : today}
					onClose={close}
					onSaved={(isNew) => {
						close();
						list.reload();
						// Analysis runs after a new entry is saved; pick up its result.
						if (isNew) {
							clearTimeout(refresh.current);
							refresh.current = setTimeout(list.reload, 12_000);
						}
					}}
					onAnalyzed={list.reload}
					onDelete={(entry) => {
						close();
						remove(entry.id, "Food entry deleted", `food/${entry.id}`);
					}}
				/>
			)}
		</AdminPage>
	);
}

function FoodEditor({
	entry,
	defaultDate,
	onClose,
	onSaved,
	onAnalyzed,
	onDelete,
}: {
	entry: FoodEntry | null;
	defaultDate: string;
	onClose: () => void;
	onSaved: (isNew: boolean) => void;
	onAnalyzed: () => void;
	onDelete: (entry: FoodEntry) => void;
}) {
	const [initial] = useState(() => ({
		date: entry?.date ?? defaultDate,
		time: entry ? timeOf(entry.eatenAt) : currentTime(),
		description: entry?.description ?? "",
	}));
	const [form, setForm] = useState(initial);
	const [photos, setPhotos] = useState<DraftPhoto[]>(() =>
		toDrafts(entry?.photos),
	);
	const [saving, setSaving] = useState(false);
	const [analyzing, setAnalyzing] = useState(false);
	const [saved, setSaved] = useState(entry);
	const dirty =
		JSON.stringify(form) !== JSON.stringify(initial) ||
		!samePhotos(photos, entry?.photos);

	async function discardAnd(then: () => void) {
		await discardUploads(photos);
		then();
	}
	async function save() {
		const [hours, minutes] = form.time.split(":").map(Number);
		const [year, month, day] = form.date.split("-").map(Number);
		setSaving(true);
		try {
			await adminRequest(`food/${entry?.id ?? crypto.randomUUID()}`, {
				method: "PUT",
				body: JSON.stringify({
					date: form.date,
					eatenAt: new Date(year, month - 1, day, hours, minutes).toISOString(),
					description: form.description.trim(),
					photoIds: photos.map((item) => item.id),
				}),
			});
			toast.success(entry ? "Entry updated" : "Entry saved. Analyzing…");
			onSaved(!entry);
		} catch (error) {
			toast.error(message(error, "Failed to save entry"));
			setSaving(false);
		}
	}
	async function analyze() {
		if (!saved) return;
		setAnalyzing(true);
		try {
			setSaved(
				await adminRequest<FoodEntry>(`food/${saved.id}/analyze`, {
					method: "POST",
				}),
			);
			onAnalyzed();
		} catch (error) {
			toast.error(message(error, "Failed to analyze"));
		} finally {
			setAnalyzing(false);
		}
	}

	return (
		<EditorSheet
			title={entry ? "Edit food" : "Log food"}
			onClose={() => void discardAnd(onClose)}
			onSubmit={() => void save()}
			onDelete={
				entry ? () => void discardAnd(() => onDelete(entry)) : undefined
			}
			saving={saving}
			dirty={dirty}
			canSubmit={
				Boolean(form.date && (form.description.trim() || photos.length)) &&
				photosReady(photos)
			}
		>
			<TextArea
				id="food-description"
				label="Description"
				value={form.description}
				onChange={(description) => setForm({ ...form, description })}
				rows={3}
				placeholder="What did you eat?"
			/>
			<PhotoField photos={photos} onChange={setPhotos} disabled={saving} />
			<DateTimeInput
				dateId="food-date"
				timeId="food-time"
				dateValue={form.date}
				timeValue={form.time}
				onDateChange={(date) => setForm({ ...form, date })}
				onTimeChange={(time) => setForm({ ...form, time })}
			/>
			{saved && (
				<section className="space-y-2 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-900">
					<div className="flex items-center justify-between gap-2">
						<h3 className="flex items-center gap-1.5 text-sm font-medium">
							<Sparkles className="h-4 w-4 text-green-600" />
							{saved.aiFoodName ?? "Not analyzed yet"}
						</h3>
						<button
							type="button"
							className={secondaryButton}
							disabled={analyzing || dirty}
							onClick={() => void analyze()}
						>
							{analyzing ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : saved.aiFoodName ? (
								"Re-analyze"
							) : (
								"Analyze"
							)}
						</button>
					</div>
					<Macros entry={saved} />
					{saved.aiNotes && (
						<p className="text-sm text-zinc-600 dark:text-zinc-400">
							{saved.aiNotes}
						</p>
					)}
					{dirty && (
						<p className="text-xs text-zinc-500">
							Save first to analyze changes.
						</p>
					)}
				</section>
			)}
		</EditorSheet>
	);
}
