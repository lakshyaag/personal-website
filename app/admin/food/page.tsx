"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import type { FoodEntry } from "@/lib/models";
import {
	VARIANTS_CONTAINER,
	VARIANTS_SECTION,
	TRANSITION_SECTION,
} from "@/lib/utils";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import {
	FormDateInput,
	FormTimeInput,
	FormTextarea,
	FormFileInput,
} from "@/components/admin/form-fields";
import {
	EmptyState,
	LoadingOverlay,
	LoadingText,
} from "@/components/admin/loading-states";
import {
	getTodayDate,
	getCurrentTime,
	formatDate,
	formatTime,
} from "@/lib/date-utils";
import { apiGet } from "@/lib/api-utils";
import { usePhotoUpload } from "@/hooks/use-photo-upload";
import { useAdminCrud } from "@/hooks/use-admin-crud";

type FoodForm = FoodEntry & { time: string };

function toFoodForm(data: unknown): FoodForm {
	const entry = data as FoodEntry;
	const time = entry.createdAt
		? new Date(entry.createdAt).toISOString().slice(11, 16)
		: getCurrentTime();
	return {
		...entry,
		time,
		description: entry.description ?? "",
		photos: entry.photos ?? [],
	};
}

function toFoodEntry(data: FoodForm): FoodEntry {
	const [hours, minutes] = (data.time || "00:00").split(":").map(Number);
	const [year, month, day] = data.date.split("-").map(Number);

	const createdAt =
		data.createdAt ||
		new Date(year, (month ?? 1) - 1, day, hours || 0, minutes || 0).toISOString();

	return {
		id: data.id,
		date: data.date,
		description: data.description || undefined,
		photos: data.photos && data.photos.length > 0 ? data.photos : undefined,
		createdAt,
	};
}

function AdminFoodPageContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const editId = searchParams.get("edit");
	const { ConfirmDialog, confirm } = useConfirmDialog();

	const [dateFilter, setDateFilter] = useState(getTodayDate());

	const getQuery = useCallback(
		() => (dateFilter ? `?date=${dateFilter}` : ""),
		[dateFilter]
	);

	const {
		items: entries,
		formData,
		editing,
		loading,
		saving,
		updateField,
		updateFields,
		saveItem,
		deleteItem,
		editItem,
		resetForm,
		loadItems,
	} = useAdminCrud<FoodForm>({
		endpoint: "/api/food",
		entityName: "food entry",
		initialFormData: {
			date: dateFilter,
			time: getCurrentTime(),
			description: "",
			photos: [],
			createdAt: new Date().toISOString(),
		},
		getQuery,
		toApi: toFoodEntry,
		fromApi: toFoodForm,
	});

	const {
		photos,
		uploading,
		uploadPhotos,
		removePhoto,
		setPhotosList,
	} = usePhotoUpload({
		folder: "food",
		identifier: formData.date.replace(/-/g, ""),
		initialPhotos: formData.photos || [],
		onPhotosChange: (newPhotos) => updateField("photos", newPhotos),
	});

	useEffect(() => {
		loadItems();
	}, [dateFilter, loadItems]);

	useEffect(() => {
		setPhotosList(formData.photos || []);
	}, [formData.photos, setPhotosList]);

	const clearEditParam = useCallback(() => {
		const url = new URL(window.location.href);
		url.searchParams.delete("edit");
		router.replace(url.pathname + url.search, { scroll: false });
	}, [router]);

	const resetFormForDate = useCallback(() => {
		resetForm();
		updateFields({
			date: dateFilter,
			time: getCurrentTime(),
			description: "",
			photos: [],
		});
		setPhotosList([]);
		clearEditParam();
	}, [dateFilter, resetForm, updateFields, setPhotosList, clearEditParam]);

	const loadEntryForEdit = useCallback(
		async (entryId: string) => {
			const result = await apiGet<FoodEntry>(`/api/food?id=${entryId}`);

			if (!result.success || !result.data) {
				toast.error(result.error || "Entry not found");
				return;
			}

			const entry = toFoodForm(result.data);
			setDateFilter(entry.date);
			editItem(entry);
			setPhotosList(entry.photos || []);
		},
		[editItem, setPhotosList]
	);

	useEffect(() => {
		if (editId) {
			loadEntryForEdit(editId);
		}
	}, [editId, loadEntryForEdit]);

	const handleSave = async () => {
		if (!formData.date) {
			toast.error("Please select a date");
			return;
		}

		await saveItem();
		resetFormForDate();
		await loadItems();
	};

	const handleDelete = async (id: string) => {
		const confirmed = await confirm({
			title: "Delete Food Entry?",
			message: "This cannot be undone.",
			variant: "danger",
			confirmLabel: "Delete",
		});

		if (!confirmed) return;

		await deleteItem(id);

		if (editing?.id === id) {
			resetFormForDate();
		}

		await loadItems();
	};

	const handleEdit = (entry: FoodForm) => {
		editItem(entry);
		setDateFilter(entry.date);
		setPhotosList(entry.photos || []);

		const url = new URL(window.location.href);
		url.searchParams.set("edit", entry.id);
		router.replace(url.pathname + url.search, { scroll: false });
	};

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
						<h1 className="text-3xl font-medium">Food Tracker</h1>
						<Link
							href="/admin/food/view"
							className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
						>
							View All Entries →
						</Link>
					</div>
					<p className="text-zinc-600 dark:text-zinc-400">
						Track what you eat throughout the day.
					</p>
				</motion.section>

				<motion.section
					className="space-y-4"
					variants={VARIANTS_SECTION}
					transition={TRANSITION_SECTION}
				>
					<h2 className="text-xl font-medium">
						{editing ? "Edit Entry" : "New Entry"}
					</h2>

					<div className="grid grid-cols-2 gap-4">
						<FormDateInput
							label="Date"
							value={formData.date}
							onChange={(e) => {
								setDateFilter(e.target.value);
								updateField("date", e.target.value);
							}}
						/>
						<FormTimeInput
							label="Time"
							value={formData.time}
							onChange={(e) => updateField("time", e.target.value)}
						/>
					</div>

					<FormTextarea
						label="Description (optional)"
						value={formData.description || ""}
						onChange={(e) => updateField("description", e.target.value)}
						rows={3}
						placeholder="What did you eat?"
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
											alt="Food"
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
							onClick={handleSave}
							disabled={saving || !formData.date}
							className="rounded-lg bg-zinc-900 px-6 py-2 text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
						>
							{saving ? "Saving..." : editing ? "Update Entry" : "Save Entry"}
						</button>
						{editing && (
							<button
								type="button"
								onClick={resetFormForDate}
								className="rounded-lg border border-zinc-300 px-6 py-2 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
							>
								Cancel
							</button>
						)}
					</div>
				</motion.section>

				<motion.section
					variants={VARIANTS_SECTION}
					transition={TRANSITION_SECTION}
				>
					<h2 className="mb-4 text-xl font-medium">
						{formatDate(dateFilter)} ({entries.length})
					</h2>

					{loading ? (
						<LoadingText text="Loading entries..." />
					) : entries.length === 0 ? (
						<EmptyState
							title="No entries for this date"
							message="Add your first entry above."
						/>
					) : (
						<div className="space-y-3">
							{entries.map((entry) => (
								<div
									key={entry.id}
									className="rounded-lg border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/50"
								>
									<div className="mb-2 flex items-start justify-between">
										<div className="flex-1">
											<div className="text-sm text-zinc-500">
												{formatTime(entry.createdAt)}
											</div>
											{entry.description && (
												<div className="mt-2 whitespace-pre-wrap text-zinc-900 dark:text-zinc-100">
													{entry.description}
												</div>
											)}
											{entry.photos && entry.photos.length > 0 && (
												<div className="mt-2 flex gap-2">
													{entry.photos.map((photo) => (
														<img
															key={photo}
															src={photo}
															alt="Food"
															className="h-20 w-20 rounded object-cover"
														/>
													))}
												</div>
											)}
										</div>
										<div className="flex gap-2">
											<button
												type="button"
												onClick={() => handleEdit(entry)}
												className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400"
											>
												Edit
											</button>
											<button
												type="button"
												onClick={() => handleDelete(entry.id)}
												className="text-sm text-red-600 hover:text-red-700 dark:text-red-400"
											>
												Delete
											</button>
										</div>
									</div>
								</div>
							))}
						</div>
					)}
				</motion.section>
			</motion.main>
		</>
	);
}

export default function AdminFoodPage() {
	return (
		<Suspense fallback={<LoadingOverlay message="Loading..." fullScreen />}>
			<AdminFoodPageContent />
		</Suspense>
	);
}
