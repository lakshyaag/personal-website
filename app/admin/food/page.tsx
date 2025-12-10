"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { FoodEntry } from "@/lib/models";
import {
	VARIANTS_CONTAINER,
	VARIANTS_SECTION,
	TRANSITION_SECTION,
} from "@/lib/utils";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormDateInput, FormTimeInput, FormTextarea, FormFileInput } from "@/components/admin/form-fields";
import { EmptyState, LoadingOverlay, LoadingText } from "@/components/admin/loading-states";
import { getTodayDate, getCurrentTime, formatDate, formatTime } from "@/lib/date-utils";
import { apiGet } from "@/lib/api-utils";
import { usePhotoUpload } from "@/hooks/use-photo-upload";
import { toast } from "sonner";

function AdminFoodPageContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const editId = searchParams.get("edit");
	const { ConfirmDialog, confirm } = useConfirmDialog();

	const [date, setDate] = useState(getTodayDate());
	const [time, setTime] = useState(getCurrentTime());
	const [description, setDescription] = useState("");
	const [entries, setEntries] = useState<FoodEntry[]>([]);
	const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null);
	const [loading, setLoading] = useState(false);
	const [saving, setSaving] = useState(false);

	const { photos, uploading, uploadPhotos, removePhoto, setPhotosList } =
		usePhotoUpload({
			folder: "food",
			identifier: date.replace(/-/g, ""),
			onPhotosChange: () => {},
		});

	const loadEntries = useCallback(async (selectedDate: string) => {
		setLoading(true);
		try {
			const result = await apiGet<FoodEntry[]>(`/api/food?date=${selectedDate}`);
			if (result.success && result.data) {
				setEntries(result.data);
			} else {
				toast.error(result.error || "Failed to load entries");
			}
		} catch (err) {
			toast.error("Failed to load entries");
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		if (editId) {
			loadEntryForEdit(editId);
		} else {
			loadEntries(date);
		}
	}, [editId]); // eslint-disable-line react-hooks/exhaustive-deps

	useEffect(() => {
		if (!editId) {
			loadEntries(date);
		}
	}, [date, editId, loadEntries]);

	const loadEntryForEdit = async (entryId: string) => {
		try {
			const result = await apiGet<FoodEntry>(`/api/food?id=${entryId}`);
			if (result.success && result.data) {
				const entry = result.data;
				setDate(entry.date);
				const entryTime = new Date(entry.createdAt);
				setTime(`${String(entryTime.getHours()).padStart(2, "0")}:${String(entryTime.getMinutes()).padStart(2, "0")}`);
				setDescription(entry.description || "");
				setPhotosList(entry.photos || []);
				setEditingEntry(entry);
				await loadEntries(entry.date);
			} else {
				toast.error("Entry not found");
			}
		} catch (err) {
			toast.error("Failed to load entry");
		}
	};

	const saveEntry = async () => {
		if (!date) {
			toast.error("Please select a date");
			return;
		}

		setSaving(true);
		try {
			const [hours, minutes] = time.split(":").map(Number);
			const [year, month, day] = date.split("-").map(Number);
			const createdAt = new Date(year, month - 1, day, hours, minutes).toISOString();

			const entryData: FoodEntry = {
				id: editingEntry?.id || crypto.randomUUID(),
				date,
				description: description || undefined,
				photos: photos.length > 0 ? photos : undefined,
				createdAt: editingEntry?.createdAt || createdAt,
			};

			const res = await fetch("/api/food", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(entryData),
			});

			if (!res.ok) throw new Error("Save failed");

			toast.success(editingEntry ? "Entry updated" : "Entry created");
			resetForm();
			await loadEntries(date);
		} catch (err) {
			toast.error("Failed to save entry");
		} finally {
			setSaving(false);
		}
	};

	const deleteEntry = async (id: string) => {
		const confirmed = await confirm({
			title: "Delete Food Entry?",
			message: "This cannot be undone.",
			variant: "danger",
			confirmLabel: "Delete",
		});

		if (!confirmed) return;

		try {
			const res = await fetch(`/api/food?id=${id}`, { method: "DELETE" });
			if (!res.ok) throw new Error("Delete failed");

			toast.success("Entry deleted");
			await loadEntries(date);

			if (editingEntry?.id === id) {
				resetForm();
			}
		} catch (err) {
			toast.error("Failed to delete entry");
		}
	};

	const editEntry = (entry: FoodEntry) => {
		const entryTime = new Date(entry.createdAt);
		setTime(`${String(entryTime.getHours()).padStart(2, "0")}:${String(entryTime.getMinutes()).padStart(2, "0")}`);
		setDescription(entry.description || "");
		setPhotosList(entry.photos || []);
		setEditingEntry(entry);
		const url = new URL(window.location.href);
		url.searchParams.set("edit", entry.id);
		router.replace(url.pathname + url.search, { scroll: false });
	};

	const resetForm() {
		const today = getTodayDate();
		setDate(today);
		setTime(getCurrentTime());
		setDescription("");
		setPhotosList([]);
		setEditingEntry(null);
		const url = new URL(window.location.href);
		url.searchParams.delete("edit");
		router.replace(url.pathname + url.search, { scroll: false });
		loadEntries(today);
	}

	return (
		<>
			<ConfirmDialog />
			<motion.main className="space-y-8 pb-16" variants={VARIANTS_CONTAINER} initial="hidden" animate="visible">
				<motion.section variants={VARIANTS_SECTION} transition={TRANSITION_SECTION}>
					<h1 className="mb-4 text-3xl font-medium">Food Tracker</h1>
					<p className="text-zinc-600 dark:text-zinc-400">Track what you eat throughout the day.</p>
				</motion.section>

				<motion.section className="space-y-4" variants={VARIANTS_SECTION} transition={TRANSITION_SECTION}>
					<h2 className="text-xl font-medium">{editingEntry ? "Edit Entry" : "New Entry"}</h2>

					<div className="grid grid-cols-2 gap-4">
						<FormDateInput label="Date" value={date} onChange={(e) => setDate(e.target.value)} />
						<FormTimeInput label="Time" value={time} onChange={(e) => setTime(e.target.value)} />
					</div>

					<FormTextarea
						label="Description (optional)"
						value={description}
						onChange={(e) => setDescription(e.target.value)}
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
										<img src={photo} alt="Food" className="h-24 w-full rounded object-cover" />
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
							onClick={saveEntry}
							disabled={saving || !date}
							className="rounded-lg bg-zinc-900 px-6 py-2 text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
						>
							{saving ? "Saving..." : editingEntry ? "Update Entry" : "Save Entry"}
						</button>
						{editingEntry && (
							<button type="button" onClick={resetForm} className="rounded-lg border border-zinc-300 px-6 py-2 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800">
								Cancel
							</button>
						)}
					</div>
				</motion.section>

				<motion.section variants={VARIANTS_SECTION} transition={TRANSITION_SECTION}>
					<h2 className="mb-4 text-xl font-medium">{formatDate(date)} ({entries.length})</h2>

					{loading ? (
						<LoadingText text="Loading entries..." />
					) : entries.length === 0 ? (
						<EmptyState title="No entries for this date" message="Add your first entry above." />
					) : (
						<div className="space-y-3">
							{entries.map((entry) => (
								<div key={entry.id} className="rounded-lg border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
									<div className="mb-2 flex items-start justify-between">
										<div className="flex-1">
											<div className="text-sm text-zinc-500">{formatTime(entry.createdAt)}</div>
											{entry.description && <div className="mt-2 whitespace-pre-wrap text-zinc-900 dark:text-zinc-100">{entry.description}</div>}
											{entry.photos && entry.photos.length > 0 && (
												<div className="mt-2 flex gap-2">
													{entry.photos.map((photo) => (
														<img key={photo} src={photo} alt="Food" className="h-20 w-20 rounded object-cover" />
													))}
												</div>
											)}
										</div>
										<div className="flex gap-2">
											<button type="button" onClick={() => editEntry(entry)} className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400">Edit</button>
											<button type="button" onClick={() => deleteEntry(entry.id)} className="text-sm text-red-600 hover:text-red-700 dark:text-red-400">Delete</button>
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
