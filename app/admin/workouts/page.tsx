"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import PhotoUploader from "@/components/admin/PhotoUploader";
import { DateInput } from "@/components/admin/DateTimeInputs";
import { formatDate } from "@/lib/date-utils";
import type { WorkoutLog } from "@/lib/models";
import {
	VARIANTS_CONTAINER,
	VARIANTS_SECTION,
	TRANSITION_SECTION,
} from "@/lib/utils";

export default function AdminWorkoutsPage() {
	const [date, setDate] = useState("");
	const [weight, setWeight] = useState("");
	const [content, setContent] = useState("");
	const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
	const [saving, setSaving] = useState(false);
	const [logs, setLogs] = useState<WorkoutLog[]>([]);
	const [editingLog, setEditingLog] = useState<WorkoutLog | null>(null);

	useEffect(() => {
		loadLogs();
		// Set today's date as default
		const today = new Date().toISOString().split("T")[0];
		setDate(today);
	}, []);

	async function loadLogs() {
		try {
			const res = await fetch("/api/workouts");
			const data = await res.json();
			setLogs(data);
		} catch (err) {
			console.error("Failed to load workout logs:", err);
		}
	}

	async function saveLog() {
		if (!date) {
			alert("Please select a date");
			return;
		}

		setSaving(true);
		try {
			const logData = {
				id: editingLog?.id,
				date,
				weight: weight ? Number.parseFloat(weight) : undefined,
				content: content || undefined,
				photos: uploadedPhotos.length > 0 ? uploadedPhotos : undefined,
			};

			const res = await fetch("/api/workouts", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(logData),
			});

			if (!res.ok) throw new Error("Save failed");

			alert(
				editingLog
					? "Workout log updated successfully!"
					: "Workout log saved successfully!",
			);
			resetForm();
			await loadLogs();
		} catch (err) {
			console.error("Save error:", err);
			alert("Failed to save workout log");
		} finally {
			setSaving(false);
		}
	}

	async function deleteLog(logId: string) {
		if (!confirm("Are you sure you want to delete this workout log?")) return;

		try {
			const res = await fetch(`/api/workouts?id=${logId}`, {
				method: "DELETE",
			});

			if (!res.ok) throw new Error("Delete failed");

			alert("Workout log deleted successfully!");
			await loadLogs();
			if (editingLog?.id === logId) {
				resetForm();
			}
		} catch (err) {
			console.error("Delete error:", err);
			alert("Failed to delete workout log");
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
						{editingLog ? "Edit Log" : "Quick Log"}
					</h2>

					<DateInput
						id="workout-date"
						label="Date"
						value={date}
						onChange={setDate}
					/>

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

					<PhotoUploader
						label="Photos (optional)"
						photos={uploadedPhotos}
						onChange={setUploadedPhotos}
						folder="workouts"
						identifier={date.replace(/-/g, "")}
					/>

					<div className="flex gap-2">
						<button
							type="button"
							onClick={saveLog}
							disabled={saving || !date}
							className="rounded-lg bg-zinc-900 px-6 py-2 text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
						>
							{saving ? "Saving..." : editingLog ? "Update Log" : "Save Log"}
						</button>
						{editingLog && (
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
					<h2 className="text-xl font-medium">Recent Logs ({logs.length})</h2>

					<div className="space-y-2">
						{logs
							.sort(
								(a, b) =>
									new Date(b.date).getTime() - new Date(a.date).getTime(),
							)
							.map((log) => (
								<div
									key={log.id}
									className="rounded-lg border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/50"
								>
									<div className="mb-2 flex items-start justify-between">
										<div className="flex-1">
											<div className="flex items-baseline gap-3">
												<div className="font-medium">
													{formatDate(log.date)}
												</div>
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
										</div>
										<div className="flex gap-2">
											<button
												type="button"
												onClick={() => editLog(log)}
												className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
											>
												Edit
											</button>
											<button
												type="button"
												onClick={() => deleteLog(log.id)}
												className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
											>
												Delete
											</button>
										</div>
									</div>
								</div>
							))}

						{logs.length === 0 && (
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
