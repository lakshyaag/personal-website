"use client";

import { motion } from "motion/react";
import Link from "next/link";
import type { WorkoutLog } from "@/lib/models";
import {
	VARIANTS_CONTAINER,
	VARIANTS_SECTION,
	TRANSITION_SECTION,
} from "@/lib/utils";
import { useAdminCrud } from "@/hooks/use-admin-crud";
import { usePhotoUpload } from "@/hooks/use-photo-upload";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import {
	FormDateInput,
	FormNumberInput,
	FormTextarea,
	FormFileInput,
} from "@/components/admin/form-fields";
import { EmptyState, LoadingOverlay } from "@/components/admin/loading-states";
import { getTodayDate, formatDate } from "@/lib/date-utils";

export default function AdminWorkoutsPage() {
	const { ConfirmDialog, confirm } = useConfirmDialog();

	// CRUD operations
	const {
		items: logs,
		formData,
		editing,
		loading,
		saving,
		updateField,
		saveItem,
		deleteItem: deleteLog,
		editItem,
		resetForm,
	} = useAdminCrud<WorkoutLog>({
		endpoint: "/api/workouts",
		entityName: "workout log",
		initialFormData: {
			date: getTodayDate(),
			content: "",
			weight: undefined,
			photos: [],
			createdAt: new Date().toISOString(),
		},
	});

	// Photo upload
	const { photos, uploading, uploadPhotos, removePhoto, setPhotosList } =
		usePhotoUpload({
			folder: "workouts",
			identifier: formData.date.replace(/-/g, ""),
			initialPhotos: formData.photos || [],
			onPhotosChange: (newPhotos) => updateField("photos", newPhotos),
		});

	// Sync photos when editing
	const handleEdit = (log: WorkoutLog) => {
		editItem(log);
		setPhotosList(log.photos || []);
	};

	// Confirm delete
	const handleDelete = async (id: string) => {
		const confirmed = await confirm({
			title: "Delete Workout Log?",
			message: "This action cannot be undone. The workout log will be permanently deleted.",
			variant: "danger",
			confirmLabel: "Delete",
		});

		if (confirmed) {
			await deleteLog(id);
		}
	};

	if (loading) {
		return <LoadingOverlay message="Loading workout logs..." fullScreen />;
	}

	return (
		<>
			<ConfirmDialog />
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
				<div className="mb-4 flex items-center justify-between">
					<h1 className="text-3xl font-medium">Workout Tracker</h1>
					<Link
						href="/admin/workouts/view"
						className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
					>
						View All Logs →
					</Link>
				</div>
				<p className="text-zinc-600 dark:text-zinc-400">
					Track your workouts with minimal friction.
				</p>
			</motion.section>

				{/* Form */}
				<motion.section
					className="space-y-8"
					variants={VARIANTS_SECTION}
					transition={TRANSITION_SECTION}
				>
					<div className="space-y-4">
						<h2 className="text-xl font-medium">
							{editing ? "Edit Log" : "Quick Log"}
						</h2>

						<FormDateInput
							label="Date"
							value={formData.date}
							onChange={(e) => updateField("date", e.target.value)}
						/>

						<FormNumberInput
							label="Bodyweight (kg)"
							step="0.1"
							value={formData.weight?.toString() || ""}
							onChange={(e) =>
								updateField(
									"weight",
									e.target.value ? parseFloat(e.target.value) : undefined
								)
							}
							placeholder="e.g., 75.5"
						/>

						<FormTextarea
							label="Notes (optional)"
							value={formData.content || ""}
							onChange={(e) => updateField("content", e.target.value)}
							placeholder="Log your workout... exercises, sets, reps, or whatever you want to track"
						/>

						<div>
							<FormFileInput
								label="Photos (optional)"
								accept="image/*"
								multiple
								disabled={uploading}
								onChange={(e) => uploadPhotos(e.target.files)}
								helperText={uploading ? "Uploading..." : undefined}
							/>

							{photos.length > 0 && (
								<div className="mt-2 grid grid-cols-3 gap-2">
									{photos.map((photo) => (
										<div key={photo} className="relative">
											<img
												src={photo}
												alt="Workout progress"
												className="h-24 w-full rounded object-cover"
											/>
											<button
												type="button"
												onClick={() => removePhoto(photo)}
												className="absolute right-1 top-1 rounded-full bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600"
											>
												×
											</button>
										</div>
									))}
								</div>
							)}
						</div>

						<div className="flex gap-2">
							<button
								type="button"
								onClick={() => saveItem()}
								disabled={saving || !formData.date}
								className="rounded-lg bg-zinc-900 px-6 py-2 text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
							>
								{saving ? "Saving..." : editing ? "Update Log" : "Save Log"}
							</button>
							{editing && (
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

				{/* Logs List */}
				<motion.section
					variants={VARIANTS_SECTION}
					transition={TRANSITION_SECTION}
				>
					<div className="space-y-4">
						<h2 className="text-xl font-medium">
							Recent Logs ({logs.length})
						</h2>

						{logs.length === 0 ? (
							<EmptyState
								title="No workout logs yet"
								message="Add your first entry above to start tracking your progress."
							/>
						) : (
							<div className="space-y-2">
								{logs
									.sort(
										(a, b) =>
											new Date(b.date).getTime() - new Date(a.date).getTime()
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
														<div className="mt-2 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
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
														onClick={() => handleEdit(log)}
														className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
													>
														Edit
													</button>
													<button
														type="button"
														onClick={() => handleDelete(log.id)}
														className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
													>
														Delete
													</button>
												</div>
											</div>
										</div>
									))}
							</div>
						)}
					</div>
				</motion.section>
			</motion.main>
		</>
	);
}
