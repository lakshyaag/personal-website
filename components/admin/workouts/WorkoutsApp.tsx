"use client";

import { DateInput } from "@/components/admin/DateTimeInputs";
import { NumberInput, TextArea } from "@/components/admin/FormInputs";
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
	useAnalysisRefresh,
	useAnalyzedEntry,
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
import { type WorkoutLog, workoutListSchema } from "@/shared/workouts";
import { BarChart3, Loader2, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { ExerciseCard } from "./ExerciseCard";

const parse = (data: unknown) => workoutListSchema.parse(data).logs;
const views = [
	{ value: "day", label: "Day" },
	{ value: "all", label: "All" },
] as const;

function Summary({ log }: { log: WorkoutLog }) {
	if (!log.aiSessionType) return null;
	return (
		<div className="mt-2 flex flex-wrap gap-1.5 text-xs">
			<span className="rounded-full bg-purple-100 px-2 py-0.5 capitalize text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
				{log.aiSessionType}
			</span>
			{log.aiExercises && (
				<span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
					{log.aiExercises.length} exercises
				</span>
			)}
			{log.aiTotalVolume ? (
				<span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
					{log.aiTotalVolume.toLocaleString()} lbs
				</span>
			) : null}
		</div>
	);
}

export default function WorkoutsApp() {
	const today = localDate();
	const [view, setView] = useState<"day" | "all">("day");
	const [day, setDay] = useState(today);
	const list = useAdminList(
		view === "day" ? `workouts?date=${day}` : "workouts",
		parse,
	);
	const { hidden, remove } = useUndoDelete();
	const [editor, setEditor] = useState<{ log: WorkoutLog | null } | null>(null);
	useAnalysisRefresh(list.items, list.refresh);

	const logs = list.items.filter((log) => !hidden.has(log.id));
	const card = (log: WorkoutLog) => (
		<RecordCard
			key={log.id}
			label={`Edit workout on ${formatDate(log.date)}`}
			onOpen={() => setEditor({ log })}
			media={<LibraryPhotoGrid photos={log.photos} />}
		>
			{log.weight !== undefined && (
				<div className="text-xs text-zinc-500">{log.weight} kg</div>
			)}
			{log.content && (
				<p className="mt-1 line-clamp-4 whitespace-pre-wrap">{log.content}</p>
			)}
			{log.analysisPending && !log.aiSessionType && (
				<div className="mt-2 flex items-center gap-1 text-xs text-zinc-500">
					<Loader2 className="h-3 w-3 animate-spin" />
					Analyzing…
				</div>
			)}
			<Summary log={log} />
		</RecordCard>
	);

	return (
		<AdminPage
			title="Workouts"
			actions={
				<>
					<Link
						href="/admin/workouts/dashboard"
						aria-label="Stats"
						className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-300 dark:border-zinc-700"
					>
						<BarChart3 className="h-4 w-4" />
					</Link>
					<Segmented
						label="View"
						value={view}
						options={views}
						onChange={setView}
					/>
				</>
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
						{logs.map(card)}
						{logs.length === 0 && (
							<EmptyState>No workout on {formatDate(day)}.</EmptyState>
						)}
					</div>
				) : (
					<div className="space-y-3">
						{logs.length === 0 && <EmptyState>No workouts yet.</EmptyState>}
						{Object.entries(groupBy(logs, (log) => log.date))
							.sort(([a], [b]) => b.localeCompare(a))
							.map(([date, group]) => (
								<section key={date} className="space-y-3">
									<GroupHeader>{formatDate(date)}</GroupHeader>
									{group.map(card)}
								</section>
							))}
					</div>
				))}
			<Fab label="Log workout" onClick={() => setEditor({ log: null })} />
			{editor && (
				<WorkoutEditor
					key={editor.log?.id ?? "new"}
					log={editor.log}
					defaultDate={view === "day" ? day : today}
					onClose={() => setEditor(null)}
					onSaved={() => {
						setEditor(null);
						list.reload();
					}}
					onAnalyzed={list.refresh}
					onDelete={(log) => {
						setEditor(null);
						remove(log.id, "Workout deleted", `workouts/${log.id}`);
					}}
				/>
			)}
		</AdminPage>
	);
}

function WorkoutEditor({
	log,
	defaultDate,
	onClose,
	onSaved,
	onAnalyzed,
	onDelete,
}: {
	log: WorkoutLog | null;
	defaultDate: string;
	onClose: () => void;
	onSaved: () => void;
	onAnalyzed: () => void;
	onDelete: (log: WorkoutLog) => void;
}) {
	const [initial] = useState(() => ({
		date: log?.date ?? defaultDate,
		weight: log?.weight?.toString() ?? "",
		content: log?.content ?? "",
	}));
	const [form, setForm] = useState(initial);
	const [photos, setPhotos] = useState<DraftPhoto[]>(() =>
		toDrafts(log?.photos),
	);
	const [saving, setSaving] = useState(false);
	const [analyzing, setAnalyzing] = useState(false);
	const [saved, setSaved] = useAnalyzedEntry(
		log,
		"workouts",
		useCallback(
			(next: WorkoutLog) => {
				onAnalyzed();
				if (!next.aiSessionType) toast.error("Analysis failed. Try again.");
			},
			[onAnalyzed],
		),
	);
	const analysisBusy = analyzing || Boolean(saved?.analysisPending);
	const dirty =
		JSON.stringify(form) !== JSON.stringify(initial) ||
		!samePhotos(photos, log?.photos);

	async function discardAnd(then: () => void) {
		await discardUploads(photos);
		then();
	}
	async function save() {
		const weight = form.weight ? Number.parseFloat(form.weight) : null;
		setSaving(true);
		try {
			await adminRequest(`workouts/${log?.id ?? crypto.randomUUID()}`, {
				method: "PUT",
				body: JSON.stringify({
					date: form.date,
					content: form.content.trim(),
					weight: weight !== null && Number.isFinite(weight) ? weight : null,
					photoIds: photos.map((item) => item.id),
				}),
			});
			toast.success(log ? "Workout updated" : "Workout saved");
			onSaved();
		} catch (error) {
			toast.error(message(error, "Failed to save workout"));
			setSaving(false);
		}
	}
	async function analyze() {
		if (!saved) return;
		setAnalyzing(true);
		try {
			setSaved(
				await adminRequest<WorkoutLog>(`workouts/${saved.id}/analyze`, {
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
			title={log ? "Edit workout" : "Log workout"}
			onClose={() => void discardAnd(onClose)}
			onSubmit={() => void save()}
			onDelete={log ? () => void discardAnd(() => onDelete(log)) : undefined}
			saving={saving}
			dirty={dirty}
			canSubmit={
				Boolean(
					form.date && (form.content.trim() || form.weight || photos.length),
				) && photosReady(photos)
			}
		>
			<TextArea
				id="workout-content"
				label="Workout"
				value={form.content}
				onChange={(content) => setForm({ ...form, content })}
				rows={5}
				placeholder="Exercises, sets, reps… however you like"
			/>
			<div className="grid grid-cols-2 gap-3">
				<DateInput
					id="workout-date"
					label="Date"
					value={form.date}
					onChange={(date) => setForm({ ...form, date })}
				/>
				<NumberInput
					id="workout-weight"
					label="Bodyweight (kg)"
					value={form.weight}
					onChange={(weight) => setForm({ ...form, weight })}
					step={0.1}
					placeholder="75.5"
				/>
			</div>
			<PhotoField photos={photos} onChange={setPhotos} disabled={saving} />
			{saved?.content && (
				<section className="space-y-3 rounded-xl bg-zinc-50 p-3 dark:bg-zinc-900">
					<div className="flex items-center justify-between gap-2">
						<h3 className="flex items-center gap-1.5 text-sm font-medium">
							<Sparkles className="h-4 w-4 text-purple-600" />
							{saved.aiSessionType
								? "Analysis"
								: saved.analysisPending
									? "Analyzing…"
									: "Not analyzed yet"}
						</h3>
						<button
							type="button"
							className={secondaryButton}
							disabled={analysisBusy || dirty}
							onClick={() => void analyze()}
						>
							{analysisBusy ? (
								<Loader2 className="h-4 w-4 animate-spin" />
							) : saved.aiSessionType ? (
								"Re-analyze"
							) : (
								"Analyze"
							)}
						</button>
					</div>
					<Summary log={saved} />
					{saved.aiMuscleGroups && saved.aiMuscleGroups.length > 0 && (
						<p className="text-sm text-zinc-600 dark:text-zinc-400">
							{saved.aiMuscleGroups.join(" · ")}
						</p>
					)}
					{saved.aiExercises?.map((exercise, index) => (
						<ExerciseCard
							key={`${exercise.name}-${index}`}
							exercise={exercise}
						/>
					))}
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
