"use client";

import { useState, useEffect, useCallback } from "react";
import PhotoUploader from "@/components/admin/PhotoUploader";
import { DateInput } from "@/components/admin/DateTimeInputs";
import { TextArea, NumberInput } from "@/components/admin/FormInputs";
import { FormActions } from "@/components/admin/FormActions";
import { EntryCard, EntryCardList } from "@/components/admin/EntryCard";
import { PageHeader, SectionHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/admin/EmptyState";
import {
	AdminPageWrapper,
	AdminSection,
} from "@/components/admin/AdminPageWrapper";
import {
	ViewModeToggle,
	type ViewMode,
} from "@/components/admin/ViewModeToggle";
import { GroupedEntriesList } from "@/components/admin/GroupedEntriesList";
import { useAdminCrud } from "@/hooks/useAdminCrud";
import { formatDate, getTodayDate } from "@/lib/date-utils";
import type { WorkoutLog } from "@/lib/models";

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

	const { saving, loading, save, remove, loadByDate, loadGrouped } =
		useAdminCrud<WorkoutLog>({
			endpoint: "/api/workouts",
			entityName: "workout log",
			useAlert: true,
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

	function renderLogCard(log: WorkoutLog, showDate = true) {
		return (
			<EntryCard onEdit={() => editLog(log)} onDelete={() => deleteLog(log.id)}>
				<div className="flex items-baseline gap-3">
					{showDate && (
						<div className="font-medium">{formatDate(log.date)}</div>
					)}
					{log.weight && (
						<div
							className={`text-sm ${showDate ? "text-zinc-600 dark:text-zinc-400" : "font-medium text-zinc-900 dark:text-zinc-100"}`}
						>
							{log.weight} kg
						</div>
					)}
				</div>
				{log.content && (
					<div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
						{log.content}
					</div>
				)}
				{log.photos && log.photos.length > 0 && (
					<div className="mt-2 flex gap-2">
						{log.photos.map((photo) => (
							<img
								key={photo}
								src={photo}
								alt="Workout progress"
								className="h-16 w-16 rounded object-cover"
							/>
						))}
					</div>
				)}
			</EntryCard>
		);
	}

	return (
		<AdminPageWrapper>
			<PageHeader
				title="Workout Tracker"
				description="Track your workouts with minimal friction."
			/>

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
		</AdminPageWrapper>
	);
}
