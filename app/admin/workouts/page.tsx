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
import { FormActions } from "@/components/admin/FormActions";
import { NumberInput, TextArea } from "@/components/admin/FormInputs";
import { GroupedEntriesList } from "@/components/admin/GroupedEntriesList";
import { PageHeader, SectionHeader } from "@/components/admin/PageHeader";
import PhotoUploader from "@/components/admin/PhotoUploader";
import {
	type ViewMode,
	ViewModeToggle,
} from "@/components/admin/ViewModeToggle";
import {
	WorkoutAnalysisModal,
	type WorkoutAnalysisResult,
} from "@/components/admin/WorkoutAnalysisModal";
import { useAdminCrud } from "@/hooks/useAdminCrud";
import { formatDate, getTodayDate } from "@/lib/date-utils";
import type { WorkoutLog } from "@/lib/models";
import { BarChart3, Sparkles } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";

export default function AdminWorkoutsPage() {
	const [date, setDate] = useState("");
	const [weight, setWeight] = useState("");
	const [content, setContent] = useState("");
	const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
	const [editingLog, setEditingLog] = useState<WorkoutLog | null>(null);
	const [todaysLogs, setTodaysLogs] = useState<WorkoutLog[]>([]);
	const [allLogsGrouped, setAllLogsGrouped] = useState<
		Record<string, WorkoutLog[]>
	>({});
	const [viewMode, setViewMode] = useState<ViewMode>("date");

	const [analyzingLog, setAnalyzingLog] = useState<WorkoutLog | null>(null);
	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [analysisResult, setAnalysisResult] =
		useState<WorkoutAnalysisResult | null>(null);

	const { saving, loading, save, remove, loadByDate, loadGrouped } =
		useAdminCrud<WorkoutLog>({
			endpoint: "/api/workouts",
			entityName: "workout log",
		});

	const loadTodaysLogs = useCallback(
		async (selectedDate: string) => {
			if (!selectedDate) return;
			const logs = await loadByDate(selectedDate);
			setTodaysLogs(logs);
		},
		[loadByDate],
	);

	const loadAllLogs = useCallback(async () => {
		const grouped = await loadGrouped();
		setAllLogsGrouped(grouped);
	}, [loadGrouped]);

	useEffect(() => {
		const today = getTodayDate();
		setDate(today);
		loadTodaysLogs(today);
	}, [loadTodaysLogs]);

	const handleDateChange = useCallback(
		(newDate: string) => {
			setDate(newDate);
			loadTodaysLogs(newDate);
		},
		[loadTodaysLogs],
	);

	const handleViewModeChange = useCallback(
		(mode: ViewMode) => {
			setViewMode(mode);
			if (mode === "all") {
				loadAllLogs();
			} else {
				loadTodaysLogs(date);
			}
		},
		[loadAllLogs, loadTodaysLogs, date],
	);

	async function saveLog() {
		if (!date) {
			alert("Please select a date");
			return;
		}

		const savedDate = date;
		const logData: WorkoutLog = {
			id: editingLog?.id || crypto.randomUUID(),
			date,
			weight: weight ? Number.parseFloat(weight) : undefined,
			content: content || undefined,
			photos: uploadedPhotos.length > 0 ? uploadedPhotos : undefined,
		};

		const success = await save(logData);
		if (success) {
			resetForm();
			if (viewMode === "all") {
				await loadAllLogs();
			} else {
				setDate(savedDate);
				await loadTodaysLogs(savedDate);
			}
		}
	}

	async function deleteLog(logId: string) {
		const success = await remove(logId);
		if (success) {
			if (editingLog?.id === logId) {
				resetForm();
			}
			if (viewMode === "all") {
				await loadAllLogs();
			} else {
				await loadTodaysLogs(date);
			}
		}
	}

	function editLog(log: WorkoutLog) {
		setDate(log.date);
		setWeight(log.weight?.toString() || "");
		setContent(log.content || "");
		setUploadedPhotos(log.photos || []);
		setEditingLog(log);
		setViewMode("date");
		loadTodaysLogs(log.date);
	}

	function resetForm() {
		const today = getTodayDate();
		setDate(today);
		setWeight("");
		setContent("");
		setUploadedPhotos([]);
		setEditingLog(null);
	}

	async function handleAnalyze(log: WorkoutLog) {
		setAnalyzingLog(log);
		setAnalysisResult(null);
		setIsAnalyzing(true);

		try {
			const response = await fetch("/api/workouts/analyze", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ entryId: log.id }),
			});

			if (!response.ok) {
				throw new Error("Analysis failed");
			}

			const result = await response.json();
			setAnalysisResult(result);

			if (viewMode === "all") {
				await loadAllLogs();
			} else {
				await loadTodaysLogs(date);
			}
		} catch (error) {
			console.error("Workout analysis error:", error);
			alert("Failed to analyze workout");
		} finally {
			setIsAnalyzing(false);
		}
	}

	function openAnalysisModal(log: WorkoutLog) {
		setAnalyzingLog(log);
		setAnalysisResult(null);

		if (!log.aiSessionType) {
			handleAnalyze(log);
		}
	}

	function closeAnalysisModal() {
		setAnalyzingLog(null);
		setAnalysisResult(null);
		setIsAnalyzing(false);
	}

	function renderLogCard(log: WorkoutLog, showDate = false) {
		const title = showDate
			? formatDate(log.date)
			: log.weight
				? `${log.weight} kg`
				: "Workout";

		const meta =
			showDate && log.weight
				? `${log.weight} kg`
				: showDate
					? null
					: log.weight
						? null
						: null;

		const hasAnalysis = !!log.aiSessionType;

		return (
			<EntryCard
				title={title}
				meta={meta}
				body={
					log.content ? (
						<div className="whitespace-pre-wrap">{log.content}</div>
					) : null
				}
				photos={log.photos}
				actions={
					<div className="flex flex-col gap-2 ml-4 flex-shrink-0">
						<EntryCardActionButton
							onClick={() => openAnalysisModal(log)}
							variant={hasAnalysis ? "neutral" : "success"}
						>
							<span className="flex items-center gap-1">
								<Sparkles className="w-3 h-3" />
								{hasAnalysis ? "View Analysis" : "Analyze"}
							</span>
						</EntryCardActionButton>
						<EntryCardActionButton
							onClick={() => editLog(log)}
							variant="neutral"
						>
							Edit
						</EntryCardActionButton>
						<EntryCardActionButton
							onClick={() => deleteLog(log.id)}
							variant="danger"
						>
							Delete
						</EntryCardActionButton>
					</div>
				}
			/>
		);
	}

	return (
		<AdminPageWrapper>
			<div className="flex items-start justify-between">
				<PageHeader
					title="Workout Tracker"
					description="Track your workouts with minimal friction."
				/>
				<Link
					href="/admin/workouts/dashboard"
					className="flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg bg-purple-100 text-purple-700 hover:bg-purple-200 dark:bg-purple-900/30 dark:text-purple-300 dark:hover:bg-purple-900/50 transition-colors"
				>
					<BarChart3 className="w-4 h-4" />
					Dashboard
				</Link>
			</div>

			<AdminSection className="space-y-8">
				<div className="space-y-4">
					<SectionHeader title={editingLog ? "Edit Log" : "Quick Log"} />

					<DateInput
						id="workout-date"
						label="Date"
						value={date}
						onChange={handleDateChange}
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

					<PhotoUploader
						label="Photos (optional)"
						photos={uploadedPhotos}
						onChange={setUploadedPhotos}
						folder="workouts"
						identifier={date.replace(/-/g, "")}
					/>

					<FormActions
						saving={saving}
						isEditing={!!editingLog}
						onSave={saveLog}
						onCancel={resetForm}
						disabled={!date}
						saveLabel="Save Log"
						saveEditLabel="Update Log"
					/>
				</div>
			</AdminSection>

			<AdminSection>
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<SectionHeader title="Logs" />
						<ViewModeToggle
							viewMode={viewMode}
							onViewModeChange={handleViewModeChange}
							allLabel="All Logs"
						/>
					</div>

					{loading && (
						<p className="text-center text-zinc-600 dark:text-zinc-400 py-8">
							Loading...
						</p>
					)}

					{!loading && viewMode === "date" && (
						<div className="space-y-3">
							<h3 className="text-lg font-medium text-zinc-700 dark:text-zinc-300">
								{formatDate(date)} ({todaysLogs.length})
							</h3>
							<EntryCardList>
								{todaysLogs.map((log) => (
									<div key={log.id}>{renderLogCard(log)}</div>
								))}
								{todaysLogs.length === 0 && (
									<EmptyState message="No logs for this day yet. Add your first entry!" />
								)}
							</EntryCardList>
						</div>
					)}

					{!loading && viewMode === "all" && (
						<GroupedEntriesList
							groupedEntries={allLogsGrouped}
							renderEntry={(log) => renderLogCard(log, false)}
							getEntryKey={(log) => log.id}
							emptyMessage="No workout logs yet. Add your first entry!"
						/>
					)}
				</div>
			</AdminSection>

			<WorkoutAnalysisModal
				entry={analyzingLog}
				onClose={closeAnalysisModal}
				isAnalyzing={isAnalyzing}
				analysisResult={analysisResult}
				onAnalyze={handleAnalyze}
			/>
		</AdminPageWrapper>
	);
}
