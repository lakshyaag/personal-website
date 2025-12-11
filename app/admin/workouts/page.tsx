"use client";

import { useState, useEffect } from "react";
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
import { useAdminCrud } from "@/hooks/useAdminCrud";
import { formatDate } from "@/lib/date-utils";
import type { WorkoutLog } from "@/lib/models";

export default function AdminWorkoutsPage() {
	const [date, setDate] = useState("");
	const [weight, setWeight] = useState("");
	const [content, setContent] = useState("");
	const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
	const [editingLog, setEditingLog] = useState<WorkoutLog | null>(null);

	const { items: logs, saving, loadAll, save, remove } = useAdminCrud<WorkoutLog>({
		endpoint: "/api/workouts",
		entityName: "workout log",
		useAlert: true,
	});

	useEffect(() => {
		loadAll();
		// Set today's date as default
		const today = new Date().toISOString().split("T")[0];
		setDate(today);
	}, [loadAll]);

	async function saveLog() {
		if (!date) {
			alert("Please select a date");
			return;
		}

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
			await loadAll();
		}
	}

	async function deleteLog(logId: string) {
		const success = await remove(logId);
		if (success) {
			await loadAll();
			if (editingLog?.id === logId) {
				resetForm();
			}
		}
	}

	function editLog(log: WorkoutLog) {
		setDate(log.date);
		setWeight(log.weight?.toString() || "");
		setContent(log.content || "");
		setUploadedPhotos(log.photos || []);
		setEditingLog(log);
	}

	function resetForm() {
		const today = new Date().toISOString().split("T")[0];
		setDate(today);
		setWeight("");
		setContent("");
		setUploadedPhotos([]);
		setEditingLog(null);
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
						onChange={setDate}
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
					<SectionHeader title="Recent Logs" count={logs.length} />

					<EntryCardList>
						{logs
							.sort(
								(a, b) =>
									new Date(b.date).getTime() - new Date(a.date).getTime(),
							)
							.map((log) => (
								<EntryCard
									key={log.id}
									onEdit={() => editLog(log)}
									onDelete={() => deleteLog(log.id)}
								>
									<div className="flex items-baseline gap-3">
										<div className="font-medium">{formatDate(log.date)}</div>
										{log.weight && (
											<div className="text-sm text-zinc-600 dark:text-zinc-400">
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
							))}

						{logs.length === 0 && (
							<EmptyState message="No workout logs yet. Add your first entry!" />
						)}
					</EntryCardList>
				</div>
			</AdminSection>
		</AdminPageWrapper>
	);
}
