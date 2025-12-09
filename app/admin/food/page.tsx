"use client";

import { useState, useCallback, useMemo, useRef, Suspense } from "react";
import { motion } from "motion/react";
import { useRouter, useSearchParams } from "next/navigation";
import type { FoodEntry } from "@/lib/models";
import {
	VARIANTS_CONTAINER,
	VARIANTS_SECTION,
	TRANSITION_SECTION,
} from "@/lib/utils";
import { toast } from "sonner";

function getTodayDate() {
	return new Date().toISOString().split("T")[0];
}

function getCurrentTime() {
	const now = new Date();
	const hours = String(now.getHours()).padStart(2, "0");
	const minutes = String(now.getMinutes()).padStart(2, "0");
	return `${hours}:${minutes}`;
}

function AdminFoodPageContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const editId = searchParams.get("edit");
	const initializedRef = useRef(false);

	// Initialize date from URL edit param or default to today
	const initialDate = useMemo(() => getTodayDate(), []);
	const initialTime = useMemo(() => getCurrentTime(), []);

	const [date, setDate] = useState(initialDate);
	const [time, setTime] = useState(initialTime);
	const [description, setDescription] = useState("");
	const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
	const [uploading, setUploading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [todaysEntries, setTodaysEntries] = useState<FoodEntry[]>([]);
	const [allEntriesGrouped, setAllEntriesGrouped] = useState<
		Record<string, FoodEntry[]>
	>({});
	const [viewMode, setViewMode] = useState<"date" | "all">("date");
	const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null);
	const [loadingEntries, setLoadingEntries] = useState(false);

	const loadTodaysEntries = useCallback(async (selectedDate: string) => {
		if (!selectedDate) return;

		setLoadingEntries(true);
		try {
			const res = await fetch(`/api/food?date=${selectedDate}`);
			if (!res.ok) throw new Error("Failed to fetch entries");
			const data = await res.json();
			setTodaysEntries(data);
		} catch (err) {
			console.error("Failed to load food entries:", err);
			toast.error("Failed to load entries");
		} finally {
			setLoadingEntries(false);
		}
	}, []);

	const loadAllEntries = useCallback(async () => {
		setLoadingEntries(true);
		try {
			const res = await fetch("/api/food?grouped=true");
			if (!res.ok) throw new Error("Failed to fetch entries");
			const data = await res.json();
			setAllEntriesGrouped(data);
		} catch (err) {
			console.error("Failed to load all food entries:", err);
			toast.error("Failed to load entries");
		} finally {
			setLoadingEntries(false);
		}
	}, []);

	const loadEntryForEdit = useCallback(
		async (entryId: string) => {
			try {
				const res = await fetch(`/api/food?id=${entryId}`);
				if (!res.ok) {
					if (res.status === 404) {
						toast.error("Entry not found");
						return;
					}
					throw new Error("Failed to load entry");
				}
				const entry = await res.json();
				setDate(entry.date);
				// Extract time from createdAt timestamp
				const entryTime = new Date(entry.createdAt);
				const hours = String(entryTime.getHours()).padStart(2, "0");
				const minutes = String(entryTime.getMinutes()).padStart(2, "0");
				setTime(`${hours}:${minutes}`);
				setDescription(entry.description || "");
				setUploadedPhotos(entry.photos || []);
				setEditingEntry(entry);
				// Switch to date view and load entries for the entry's date
				setViewMode("date");
				await loadTodaysEntries(entry.date);
			} catch (err) {
				console.error("Failed to load entry for edit:", err);
				toast.error("Failed to load entry");
			}
		},
		[loadTodaysEntries],
	);

	// Initialize on mount (only once)
	if (!initializedRef.current) {
		initializedRef.current = true;
		if (editId) {
			loadEntryForEdit(editId);
		} else {
			loadTodaysEntries(initialDate);
		}
	}

	const handleDateChange = useCallback(
		(newDate: string) => {
			setDate(newDate);
			loadTodaysEntries(newDate);
		},
		[loadTodaysEntries],
	);

	async function handlePhotoUpload(files: FileList | null) {
		if (!files || files.length === 0) return;

		setUploading(true);
		try {
			const urls: string[] = [];
			for (const file of Array.from(files)) {
				const form = new FormData();
				form.append("file", file);
				form.append("folder", "food");
				form.append("identifier", date.replace(/-/g, ""));

				const res = await fetch("/api/upload", {
					method: "POST",
					body: form,
				});

				if (!res.ok) throw new Error("Upload failed");

				const { url } = await res.json();
				urls.push(url);
			}

			setUploadedPhotos([...uploadedPhotos, ...urls]);
			toast.success(`${urls.length} photo(s) uploaded successfully`);
		} catch (err) {
			console.error("Upload error:", err);
			toast.error("Failed to upload photos");
		} finally {
			setUploading(false);
		}
	}

	async function saveEntry() {
		if (!date) {
			toast.error("Please select a date");
			return;
		}

		if (!description && uploadedPhotos.length === 0) {
			toast.error("Please add a description or photos");
			return;
		}

		setSaving(true);
		const savedDate = date; // Store the date before reset
		try {
			// Combine date and time into ISO timestamp
			const [hours, minutes] = time.split(":");
			const dateTime = new Date(date);
			dateTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);

			const entryData: FoodEntry = {
				id: editingEntry?.id || crypto.randomUUID(),
				date,
				description: description || undefined,
				photos: uploadedPhotos.length > 0 ? uploadedPhotos : undefined,
				createdAt: dateTime.toISOString(),
			};

			const res = await fetch("/api/food", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(entryData),
			});

			if (!res.ok) throw new Error("Save failed");

			toast.success(
				editingEntry
					? "Entry updated successfully!"
					: "Entry saved successfully!",
			);

			// Reset form and reload entries
			setDate(savedDate);
			setTime(getCurrentTime());
			setDescription("");
			setUploadedPhotos([]);
			setEditingEntry(null);
			// Clear edit query parameter from URL
			const url = new URL(window.location.href);
			url.searchParams.delete("edit");
			router.replace(url.pathname + url.search, { scroll: false });
			// Reload entries based on current view mode
			if (viewMode === "all") {
				await loadAllEntries();
			} else {
				await loadTodaysEntries(savedDate);
			}
		} catch (err) {
			console.error("Save error:", err);
			toast.error("Failed to save entry");
		} finally {
			setSaving(false);
		}
	}

	async function deleteEntry(entryId: string) {
		if (!confirm("Are you sure you want to delete this entry?")) return;

		try {
			const res = await fetch(`/api/food?id=${entryId}`, {
				method: "DELETE",
			});

			if (!res.ok) throw new Error("Delete failed");

			toast.success("Entry deleted successfully!");
			if (editingEntry?.id === entryId) {
				// If we were editing this entry, reset form
				const today = getTodayDate();
				setDate(today);
				setTime(getCurrentTime());
				setDescription("");
				setUploadedPhotos([]);
				setEditingEntry(null);
				const url = new URL(window.location.href);
				url.searchParams.delete("edit");
				router.replace(url.pathname + url.search, { scroll: false });
			}
			// Reload entries based on current view mode
			if (viewMode === "all") {
				await loadAllEntries();
			} else {
				await loadTodaysEntries(date);
			}
		} catch (err) {
			console.error("Delete error:", err);
			toast.error("Failed to delete entry");
		}
	}

	function editEntry(entry: FoodEntry) {
		setDate(entry.date);
		// Extract time from createdAt timestamp
		const entryTime = new Date(entry.createdAt);
		const hours = String(entryTime.getHours()).padStart(2, "0");
		const minutes = String(entryTime.getMinutes()).padStart(2, "0");
		setTime(`${hours}:${minutes}`);
		setDescription(entry.description || "");
		setUploadedPhotos(entry.photos || []);
		setEditingEntry(entry);
		// Switch to date view and load entries for the entry's date
		setViewMode("date");
		loadTodaysEntries(entry.date);
	}

	function resetForm() {
		const today = getTodayDate();
		setDate(today);
		setTime(getCurrentTime());
		setDescription("");
		setUploadedPhotos([]);
		setEditingEntry(null);
		// Clear edit query parameter from URL
		const url = new URL(window.location.href);
		url.searchParams.delete("edit");
		router.replace(url.pathname + url.search, { scroll: false });
		// Reload entries for today
		loadTodaysEntries(today);
	}

	function formatTime(isoString: string): string {
		const date = new Date(isoString);
		return date.toLocaleTimeString("en-US", {
			hour: "numeric",
			minute: "2-digit",
			hour12: true,
		});
	}

	function formatDate(dateStr: string): string {
		// Parse date string as local date (YYYY-MM-DD format)
		const [year, month, day] = dateStr.split("-").map(Number);
		const date = new Date(year, month - 1, day);
		return date.toLocaleDateString("en-US", {
			weekday: "short",
			year: "numeric",
			month: "short",
			day: "numeric",
		});
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
				<div className="flex items-center justify-between mb-4">
					<h1 className="text-3xl font-medium">Food Tracker</h1>
				</div>
				<p className="text-zinc-600 dark:text-zinc-400">
					Track your daily food intake with photos and descriptions.
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
						{editingEntry ? "Edit Entry" : "New Entry"}
					</h2>

					<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
						<div>
							<label
								htmlFor="food-date"
								className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
							>
								Date
							</label>
							<input
								id="food-date"
								type="date"
								value={date}
								onChange={(e) => handleDateChange(e.target.value)}
								className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
							/>
						</div>
						<div>
							<label
								htmlFor="food-time"
								className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
							>
								Time
							</label>
							<input
								id="food-time"
								type="time"
								value={time}
								onChange={(e) => setTime(e.target.value)}
								className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
							/>
						</div>
					</div>

					<div>
						<label
							htmlFor="food-description"
							className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
						>
							Description
						</label>
						<textarea
							id="food-description"
							value={description}
							onChange={(e) => setDescription(e.target.value)}
							rows={4}
							placeholder="What did you eat? (e.g., Grilled chicken salad with avocado and olive oil)"
							className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
						/>
					</div>

					<div>
						<label
							htmlFor="food-photos"
							className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
						>
							Photos (optional)
						</label>
						<input
							id="food-photos"
							type="file"
							accept="image/*"
							multiple
							onChange={(e) => handlePhotoUpload(e.target.files)}
							disabled={uploading}
							className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
						/>
						{uploading && (
							<p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
								Uploading...
							</p>
						)}
						{uploadedPhotos.length > 0 && (
							<div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
								{uploadedPhotos.map((photo) => (
									<div key={photo} className="relative">
										<img
											src={photo}
											alt="Food"
											className="h-24 w-full rounded object-cover"
										/>
										<button
											type="button"
											onClick={() =>
												setUploadedPhotos(
													uploadedPhotos.filter((p) => p !== photo),
												)
											}
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
							{saving
								? "Saving..."
								: editingEntry
									? "Update Entry"
									: "Save Entry"}
						</button>
						{editingEntry && (
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
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<h2 className="text-xl font-medium">Entries</h2>
						<div className="flex gap-2">
							<button
								type="button"
								onClick={() => {
									setViewMode("date");
									loadTodaysEntries(date);
								}}
								className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
									viewMode === "date"
										? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
										: "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
								}`}
							>
								By Date
							</button>
							<button
								type="button"
								onClick={() => {
									setViewMode("all");
									loadAllEntries();
								}}
								className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
									viewMode === "all"
										? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
										: "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
								}`}
							>
								All Entries
							</button>
						</div>
					</div>

					{loadingEntries && (
						<p className="text-center text-zinc-600 dark:text-zinc-400 py-8">
							Loading...
						</p>
					)}

					{!loadingEntries && viewMode === "date" && (
						<div className="space-y-3">
							<h3 className="text-lg font-medium text-zinc-700 dark:text-zinc-300">
								{formatDate(date)} ({todaysEntries.length})
							</h3>
							{todaysEntries.map((entry) => (
								<div
									key={entry.id}
									className="rounded-lg border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/50"
								>
									<div className="mb-2 flex items-start justify-between">
										<div className="flex-1">
											<div className="text-xs text-zinc-500 dark:text-zinc-500 mb-2">
												{formatTime(entry.createdAt)}
											</div>
											{entry.description && (
												<div className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
													{entry.description}
												</div>
											)}
											{entry.photos && entry.photos.length > 0 && (
												<div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
													{entry.photos.map((photo) => (
														<img
															key={photo}
															src={photo}
															alt="Food"
															className="h-20 w-full rounded object-cover cursor-pointer hover:opacity-80 transition-opacity"
															onClick={() => window.open(photo, "_blank")}
														/>
													))}
												</div>
											)}
										</div>
										<div className="flex gap-2 ml-4">
											<button
												type="button"
												onClick={() => editEntry(entry)}
												className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
											>
												Edit
											</button>
											<button
												type="button"
												onClick={() => deleteEntry(entry.id)}
												className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
											>
												Delete
											</button>
										</div>
									</div>
								</div>
							))}

							{todaysEntries.length === 0 && (
								<p className="text-center text-zinc-600 dark:text-zinc-400 py-8">
									No entries for this day yet. Create your first one!
								</p>
							)}
						</div>
					)}

					{!loadingEntries && viewMode === "all" && (
						<div className="space-y-6">
							{Object.keys(allEntriesGrouped).length === 0 && (
								<p className="text-center text-zinc-600 dark:text-zinc-400 py-8">
									No entries yet. Create your first one!
								</p>
							)}
							{Object.keys(allEntriesGrouped)
								.sort((a, b) => b.localeCompare(a))
								.map((entryDate) => (
									<div key={entryDate} className="space-y-3">
										<h3 className="text-lg font-medium text-zinc-700 dark:text-zinc-300 sticky top-0 bg-white dark:bg-zinc-950 py-2">
											{formatDate(entryDate)} (
											{allEntriesGrouped[entryDate].length})
										</h3>
										{allEntriesGrouped[entryDate].map((entry) => (
											<div
												key={entry.id}
												className="rounded-lg border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/50"
											>
												<div className="mb-2 flex items-start justify-between">
													<div className="flex-1">
														<div className="text-xs text-zinc-500 dark:text-zinc-500 mb-2">
															{formatTime(entry.createdAt)}
														</div>
														{entry.description && (
															<div className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
																{entry.description}
															</div>
														)}
														{entry.photos && entry.photos.length > 0 && (
															<div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
																{entry.photos.map((photo) => (
																	<img
																		key={photo}
																		src={photo}
																		alt="Food"
																		className="h-20 w-full rounded object-cover cursor-pointer hover:opacity-80 transition-opacity"
																		onClick={() => window.open(photo, "_blank")}
																	/>
																))}
															</div>
														)}
													</div>
													<div className="flex gap-2 ml-4">
														<button
															type="button"
															onClick={() => editEntry(entry)}
															className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
														>
															Edit
														</button>
														<button
															type="button"
															onClick={() => deleteEntry(entry.id)}
															className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
														>
															Delete
														</button>
													</div>
												</div>
											</div>
										))}
									</div>
								))}
						</div>
					)}
				</div>
			</motion.section>
		</motion.main>
	);
}

export default function AdminFoodPage() {
	return (
		<Suspense
			fallback={
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
						<div className="flex items-center justify-between mb-4">
							<h1 className="text-3xl font-medium">Food Tracker</h1>
						</div>
						<p className="text-zinc-600 dark:text-zinc-400">
							Loading...
						</p>
					</motion.section>
				</motion.main>
			}
		>
			<AdminFoodPageContent />
		</Suspense>
	);
}
