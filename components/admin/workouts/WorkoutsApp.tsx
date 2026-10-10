"use client";

import {
	AdminPageWrapper,
	AdminSection,
} from "@/components/admin/AdminPageWrapper";
import { DateInput } from "@/components/admin/DateTimeInputs";
import { EmptyState } from "@/components/admin/EmptyState";
import {
	EntryCard,
	EntryCardActionButton,
	EntryCardList,
} from "@/components/admin/EntryCard";
import { ExerciseHistoryCard } from "@/components/admin/ExerciseHistoryCard";
import { ExerciseHistoryModal } from "@/components/admin/ExerciseHistoryModal";
import { ExerciseSearch } from "@/components/admin/ExerciseSearch";
import { FormActions } from "@/components/admin/FormActions";
import { NumberInput, TextArea } from "@/components/admin/FormInputs";
import { GroupedEntriesList } from "@/components/admin/GroupedEntriesList";
import { PageHeader, SectionHeader } from "@/components/admin/PageHeader";
import PhotoField, { type DraftPhoto } from "@/components/admin/PhotoField";
import {
	type ViewMode,
	ViewModeToggle,
} from "@/components/admin/ViewModeToggle";
import {
	WorkoutAnalysisModal,
	type WorkoutAnalysisResult,
} from "@/components/admin/WorkoutAnalysisModal";
import { adminRequest, groupBy } from "@/components/admin/client";
import {
	LibraryPhotoGrid,
	discardUploads,
	photosReady,
	toDrafts,
} from "@/components/admin/library-photos";
import { formatDate } from "@/lib/date-utils";
import { localDate } from "@/shared/common";
import {
	type WorkoutExercise,
	type WorkoutLog,
	workoutListSchema,
} from "@/shared/workouts";
import { BarChart3, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const toResult = (log: WorkoutLog): WorkoutAnalysisResult => ({
	sessionType: log.aiSessionType ?? "other",
	exercises: log.aiExercises ?? [],
	totalVolume: log.aiTotalVolume ?? null,
	muscleGroups: log.aiMuscleGroups ?? [],
	notes: log.aiNotes ?? null,
});
const message = (error: unknown, fallback: string) =>
	error instanceof Error ? error.message : fallback;

export default function WorkoutsApp() {
	const [date, setDate] = useState(localDate);
	const [weight, setWeight] = useState("");
	const [content, setContent] = useState("");
	const [photos, setPhotos] = useState<DraftPhoto[]>([]);
	const [editing, setEditing] = useState<WorkoutLog | null>(null);
	const [logs, setLogs] = useState<WorkoutLog[]>([]);
	const [viewMode, setViewMode] = useState<ViewMode>("date");
	const [activeTab, setActiveTab] = useState<"entry" | "lookup">("entry");
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [analyzing, setAnalyzing] = useState<WorkoutLog | null>(null);
	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [analysisResult, setAnalysisResult] =
		useState<WorkoutAnalysisResult | null>(null);
	const [selectedExercise, setSelectedExercise] = useState<{
		name: string;
		lastPerformed: string;
		sets: NonNullable<WorkoutExercise["sets"]>;
		notes?: string | null;
	} | null>(null);
	const [showHistory, setShowHistory] = useState(false);

	const load = useCallback(async (mode: ViewMode, day: string) => {
		setLoading(true);
		try {
			const query = mode === "date" ? `?date=${day}` : "";
			setLogs(
				workoutListSchema.parse(await adminRequest(`workouts${query}`)).logs,
			);
		} catch (error) {
			toast.error(message(error, "Failed to load workout logs"));
		} finally {
			setLoading(false);
		}
	}, []);
	useEffect(() => {
		void load("date", localDate());
	}, [load]);
	const reload = () => load(viewMode, date);

	function fill(log: WorkoutLog | null) {
		setEditing(log);
		setDate(log?.date ?? localDate());
		setWeight(log?.weight?.toString() ?? "");
		setContent(log?.content ?? "");
		setPhotos(toDrafts(log?.photos));
	}
	async function startOver(log: WorkoutLog | null) {
		await discardUploads(photos);
		fill(log);
		if (log) {
			setViewMode("date");
			void load("date", log.date);
		}
	}
	function changeDate(next: string) {
		setDate(next);
		if (viewMode === "date") void load("date", next);
	}
	function changeView(mode: ViewMode) {
		setViewMode(mode);
		void load(mode, date);
	}

	async function save() {
		if (!photosReady(photos)) {
			toast.error("Wait for photos to finish uploading");
			return;
		}
		const parsedWeight = weight ? Number.parseFloat(weight) : null;
		setSaving(true);
		try {
			await adminRequest(`workouts/${editing?.id ?? crypto.randomUUID()}`, {
				method: "PUT",
				body: JSON.stringify({
					date,
					content: content.trim(),
					weight:
						parsedWeight !== null && Number.isFinite(parsedWeight)
							? parsedWeight
							: null,
					photoIds: photos.map((item) => item.id),
				}),
			});
			toast.success(editing ? "Log updated" : "Log saved");
			const savedDate = date;
			fill(null);
			setDate(savedDate);
			await load(viewMode, savedDate);
		} catch (error) {
			toast.error(message(error, "Failed to save workout log"));
		} finally {
			setSaving(false);
		}
	}
	async function remove(log: WorkoutLog) {
		if (!window.confirm("Delete this workout log?")) return;
		try {
			await adminRequest(`workouts/${log.id}`, { method: "DELETE" });
			toast.success("Log deleted");
			if (editing?.id === log.id) fill(null);
			await reload();
		} catch (error) {
			toast.error(message(error, "Failed to delete workout log"));
		}
	}
	async function analyze(log: WorkoutLog) {
		setAnalyzing(log);
		setAnalysisResult(null);
		setIsAnalyzing(true);
		try {
			const updated = await adminRequest<WorkoutLog>(
				`workouts/${log.id}/analyze`,
				{ method: "POST" },
			);
			setAnalysisResult(toResult(updated));
			setAnalyzing(updated);
			await reload();
		} catch (error) {
			toast.error(message(error, "Failed to analyze workout"));
		} finally {
			setIsAnalyzing(false);
		}
	}
	function openAnalysis(log: WorkoutLog) {
		if (log.aiSessionType) {
			setAnalysisResult(null);
			setAnalyzing(log);
		} else void analyze(log);
	}
	async function selectExercise(exercise: { canonicalName: string }) {
		try {
			const data = await adminRequest<{
				history: {
					date: string;
					sets: NonNullable<WorkoutExercise["sets"]>;
					notes?: string | null;
				}[];
			}>(`workouts/exercises/${encodeURIComponent(exercise.canonicalName)}`);
			const last = data.history[0];
			setSelectedExercise(
				last
					? {
							name: exercise.canonicalName,
							lastPerformed: last.date,
							sets: last.sets,
							notes: last.notes,
						}
					: {
							name: exercise.canonicalName,
							lastPerformed: "Never",
							sets: [],
							notes: "No history found.",
						},
			);
		} catch (error) {
			toast.error(message(error, "Failed to load exercise history"));
		}
	}

	function card(log: WorkoutLog, showDate = false) {
		const hasAnalysis = !!log.aiSessionType;
		return (
			<EntryCard
				title={
					showDate
						? formatDate(log.date)
						: log.weight
							? `${log.weight} kg`
							: "Workout"
				}
				meta={showDate && log.weight ? `${log.weight} kg` : null}
				body={
					log.content ? (
						<div className="whitespace-pre-wrap">{log.content}</div>
					) : null
				}
				actions={
					<div className="ml-4 flex flex-shrink-0 flex-col gap-2">
						{log.content && (
							<EntryCardActionButton
								onClick={() => openAnalysis(log)}
								variant={hasAnalysis ? "neutral" : "success"}
							>
								<span className="flex items-center gap-1">
									<Sparkles className="h-3 w-3" />
									{hasAnalysis ? "View Analysis" : "Analyze"}
								</span>
							</EntryCardActionButton>
						)}
						<EntryCardActionButton
							onClick={() => void startOver(log)}
							variant="neutral"
						>
							Edit
						</EntryCardActionButton>
						<EntryCardActionButton
							onClick={() => void remove(log)}
							variant="danger"
						>
							Delete
						</EntryCardActionButton>
					</div>
				}
			>
				<LibraryPhotoGrid photos={log.photos} />
			</EntryCard>
		);
	}

	const grouped = groupBy(logs, (log) => log.date);

	return (
		<AdminPageWrapper>
			<PageHeader
				title="Workout Tracker"
				description="Track your workouts with minimal friction."
			/>
			<div className="mb-6">
				<ViewModeToggle
					viewMode={activeTab === "entry" ? "date" : "all"}
					onViewModeChange={(mode) =>
						setActiveTab(mode === "date" ? "entry" : "lookup")
					}
					dateLabel="Log Entry"
					allLabel="Exercise Lookup"
				/>
			</div>

			{activeTab === "entry" ? (
				<AdminSection className="space-y-4">
					<SectionHeader title={editing ? "Edit Log" : "Quick Log"} />
					<DateInput
						id="workout-date"
						label="Date"
						value={date}
						onChange={changeDate}
					/>
					<NumberInput
						id="workout-weight"
						label="Bodyweight (kg)"
						value={weight}
						onChange={setWeight}
						step={0.1}
						placeholder="e.g., 75.5"
					/>
					<TextArea
						id="workout-content"
						label="Notes (optional)"
						value={content}
						onChange={setContent}
						rows={4}
						placeholder="Log your workout... exercises, sets, reps, or whatever you want to track"
					/>
					<PhotoField photos={photos} onChange={setPhotos} disabled={saving} />
					<FormActions
						saving={saving}
						isEditing={!!editing}
						onSave={save}
						onCancel={() => void startOver(null)}
						disabled={
							!date ||
							!photosReady(photos) ||
							(!content.trim() && !weight && photos.length === 0)
						}
						saveLabel="Save Log"
						saveEditLabel="Update Log"
					/>
				</AdminSection>
			) : (
				<AdminSection className="space-y-4">
					<div className="flex items-center justify-between">
						<SectionHeader title="Exercise Lookup" />
						<Link
							href="/admin/workouts/dashboard"
							className="flex items-center gap-2 rounded-lg bg-purple-100 px-4 py-2 text-sm font-medium text-purple-700 transition-colors hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50"
						>
							<BarChart3 className="h-4 w-4" />
							Stats Dashboard
						</Link>
					</div>
					<ExerciseSearch onSelect={selectExercise} />
					{selectedExercise && (
						<ExerciseHistoryCard
							exerciseName={selectedExercise.name}
							lastPerformed={selectedExercise.lastPerformed}
							sets={selectedExercise.sets}
							notes={selectedExercise.notes}
							onViewHistory={() => setShowHistory(true)}
							onClear={() => setSelectedExercise(null)}
						/>
					)}
				</AdminSection>
			)}

			<AdminSection className="space-y-4">
				<div className="flex items-center justify-between">
					<SectionHeader title="Logs" />
					<ViewModeToggle
						viewMode={viewMode}
						onViewModeChange={changeView}
						allLabel="All Logs"
					/>
				</div>
				{loading ? (
					<p className="py-8 text-center text-zinc-600 dark:text-zinc-400">
						Loading...
					</p>
				) : viewMode === "date" ? (
					<div className="space-y-3">
						<h3 className="text-lg font-medium text-zinc-700 dark:text-zinc-300">
							{formatDate(date)} ({logs.length})
						</h3>
						<EntryCardList>
							{logs.map((log) => (
								<div key={log.id}>{card(log)}</div>
							))}
							{logs.length === 0 && (
								<EmptyState message="No logs for this day yet. Add your first entry!" />
							)}
						</EntryCardList>
					</div>
				) : (
					<GroupedEntriesList
						groupedEntries={grouped}
						renderEntry={(log) => card(log)}
						getEntryKey={(log) => log.id}
						emptyMessage="No workout logs yet. Add your first entry!"
					/>
				)}
			</AdminSection>

			<WorkoutAnalysisModal
				entry={analyzing}
				onClose={() => {
					setAnalyzing(null);
					setAnalysisResult(null);
				}}
				isAnalyzing={isAnalyzing}
				analysisResult={analysisResult}
				onAnalyze={(log) => void analyze(log)}
			/>
			{showHistory && selectedExercise && (
				<ExerciseHistoryModal
					exerciseName={selectedExercise.name}
					historyUrl="/api/admin/workouts/exercises"
					onClose={() => setShowHistory(false)}
				/>
			)}
		</AdminPageWrapper>
	);
}
