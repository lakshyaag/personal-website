"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import type { WorkoutLog } from "@/lib/models";
import {
	VARIANTS_CONTAINER,
	VARIANTS_SECTION,
	TRANSITION_SECTION,
} from "@/lib/utils";
import { usePhotoUpload } from "@/hooks/usePhotoUpload";
import { useEntryManager } from "@/hooks/useEntryManager";
import { PhotoUploadInput, EntryCard } from "@/components/admin";
import { formatDate, getTodayDate } from "@/lib/admin-utils";
import { toast } from "sonner";

export default function AdminWorkoutsPage() {
	const [date, setDate] = useState("");
	const [weight, setWeight] = useState("");
	const [content, setContent] = useState("");
	const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);

	const entryManager = useEntryManager<WorkoutLog>({
		resourceName: "workout log",
		apiEndpoint: "/api/workouts",
		defaultEntry: () => ({
			id: crypto.randomUUID(),
			date: getTodayDate(),
			weight: undefined,
			content: undefined,
			photos: undefined,
		}),
	});

	const { uploadPhotos, uploading } = usePhotoUpload({
		folder: "workouts",
		onUploadComplete: (urls) => setUploadedPhotos([...uploadedPhotos, ...urls]),
	});

	useEffect(() => {
		entryManager.loadEntries();
		setDate(getTodayDate());
	}, []);

	async function handlePhotoUpload(files: FileList | null) {
		await uploadPhotos(files, date.replace(/-/g, ""));
	}

	async function saveLog() {
		if (!date) {
			toast.error("Please select a date");
			return;
		}

		const logData: WorkoutLog = {
			id: entryManager.editingEntry?.id || crypto.randomUUID(),
			date,
			weight: weight ? Number.parseFloat(weight) : undefined,
			content: content || undefined,
			photos: uploadedPhotos.length > 0 ? uploadedPhotos : undefined,
		};

		try {
			await entryManager.saveEntry(logData);
			resetForm();
			await entryManager.loadEntries();
		} catch (err) {
			// Error already handled by entryManager
		}
	}

	async function handleDelete(logId: string) {
		try {
			await entryManager.deleteEntry(logId);
			if (entryManager.editingEntry?.id === logId) {
				resetForm();
			}
			await entryManager.loadEntries();
		} catch (err) {
			// Error already handled by entryManager
		}
	}

	function handleEdit(log: WorkoutLog) {
		setDate(log.date);
		setWeight(log.weight?.toString() || "");
		setContent(log.content || "");
		setUploadedPhotos(log.photos || []);
		entryManager.startEditing(log);
	}

	function resetForm() {
		setDate(getTodayDate());
		setWeight("");
		setContent("");
		setUploadedPhotos([]);
		entryManager.cancelEditing();
	}

	return (
		<motion.main
			className="space-y-8 pb-16"
			variants={VARIANTS_CONTAINER}
			initial="hidden"
			animate="visible"
		>
			<motion.section
				variants={VARIANTS_SECTION}
				transition={TRANSITION_SECTION}
			>
				<h1 className="mb-4 text-3xl font-medium">Workout Tracker</h1>
				<p className="text-zinc-600 dark:text-zinc-400">
					Track your workouts with minimal friction.
				</p>
			</motion.section>

			<motion.section
				className="space-y-8"
				variants={VARIANTS_SECTION}
				transition={TRANSITION_SECTION}
			>
				{/* Form */}
				<div className="space-y-4">
					<h2 className="text-xl font-medium">
						{entryManager.editingEntry ? "Edit Log" : "Quick Log"}
					</h2>

					<div>
						<label
							htmlFor="workout-date"
							className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
						>
							Date
						</label>
						<input
							id="workout-date"
							type="date"
							value={date}
							onChange={(e) => setDate(e.target.value)}
							className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
						/>
					</div>

					<div>
						<label
							htmlFor="workout-weight"
							className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
						>
							Bodyweight (kg)
						</label>
						<input
							id="workout-weight"
							type="number"
							step="0.1"
							value={weight}
							onChange={(e) => setWeight(e.target.value)}
							placeholder="e.g., 75.5"
							className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
						/>
					</div>

					<div>
						<label
							htmlFor="workout-content"
							className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
						>
							Notes (optional)
						</label>
						<textarea
							id="workout-content"
							value={content}
							onChange={(e) => setContent(e.target.value)}
							rows={4}
							placeholder="Log your workout... exercises, sets, reps, or whatever you want to track"
							className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
						/>
					</div>

					<PhotoUploadInput
						id="workout-photos"
						photos={uploadedPhotos}
						uploading={uploading}
						onUpload={handlePhotoUpload}
						onRemove={(photo) =>
							setUploadedPhotos(uploadedPhotos.filter((p) => p !== photo))
						}
						previewColumns={3}
					/>

					<div className="flex gap-2">
						<button
							type="button"
							onClick={saveLog}
							disabled={entryManager.saving || !date}
							className="rounded-lg bg-zinc-900 px-6 py-2 text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
						>
							{entryManager.saving
								? "Saving..."
								: entryManager.editingEntry
									? "Update Log"
									: "Save Log"}
						</button>
						{entryManager.editingEntry && (
							<button
								type="button"
								onClick={resetForm}
								className="rounded-lg border border-zinc-300 px-6 py-2 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
							>
								Cancel
							</button>
						)}
					</div>
				</div>
			</motion.section>

			<motion.section
				variants={VARIANTS_SECTION}
				transition={TRANSITION_SECTION}
			>
				{/* Logs List */}
				<div className="space-y-4">
					<h2 className="text-xl font-medium">
						Recent Logs ({entryManager.entries.length})
					</h2>

					<div className="space-y-2">
						{entryManager.entries
							.sort(
								(a, b) =>
									new Date(b.date).getTime() - new Date(a.date).getTime(),
							)
							.map((log) => (
								<EntryCard
									key={log.id}
									entry={log}
									onEdit={handleEdit}
									onDelete={handleDelete}
									showTime={false}
									photoAltText="Workout progress"
									renderCustomFields={(log) => (
										<>
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
										</>
									)}
								/>
							))}

						{entryManager.entries.length === 0 && (
							<p className="text-center text-zinc-600 dark:text-zinc-400">
								No workout logs yet. Add your first entry!
							</p>
						)}
					</div>
				</div>
			</motion.section>
		</motion.main>
	);
}
