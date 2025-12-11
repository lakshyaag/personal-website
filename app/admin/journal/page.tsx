"use client";

import { useState, useCallback, useMemo, useRef, Suspense } from "react";
import PhotoUploader from "@/components/admin/PhotoUploader";
import { motion } from "motion/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { JournalEntry } from "@/lib/models";
import {
	VARIANTS_CONTAINER,
	VARIANTS_SECTION,
	TRANSITION_SECTION,
} from "@/lib/utils";
import { toast } from "sonner";

function getTodayDate() {
	return new Date().toISOString().split("T")[0];
}

function AdminJournalPageContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const editId = searchParams.get("edit");
	const initializedRef = useRef(false);

	// Initialize date from URL edit param or default to today
	const initialDate = useMemo(() => getTodayDate(), []);

	const [date, setDate] = useState(initialDate);
	const [content, setContent] = useState("");
	const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
	const [saving, setSaving] = useState(false);
	const [todaysEntries, setTodaysEntries] = useState<JournalEntry[]>([]);
	const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);
	const [loadingEntries, setLoadingEntries] = useState(false);

	const loadTodaysEntries = useCallback(async (selectedDate: string) => {
		if (!selectedDate) return;

		setLoadingEntries(true);
		try {
			const res = await fetch(`/api/journal?date=${selectedDate}`);
			if (!res.ok) throw new Error("Failed to fetch entries");
			const data = await res.json();
			setTodaysEntries(data);
		} catch (err) {
			console.error("Failed to load journal entries:", err);
			toast.error("Failed to load entries");
		} finally {
			setLoadingEntries(false);
		}
	}, []);

	const loadEntryForEdit = useCallback(
		async (entryId: string) => {
			try {
				const res = await fetch(`/api/journal?id=${entryId}`);
				if (!res.ok) {
					if (res.status === 404) {
						toast.error("Entry not found");
						return;
					}
					throw new Error("Failed to load entry");
				}
				const entry = await res.json();
				setDate(entry.date);
				setContent(entry.content || "");
				setUploadedPhotos(entry.photos || []);
				setEditingEntry(entry);
				// Load entries for the entry's date
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

	async function saveEntry() {
		if (!date) {
			toast.error("Please select a date");
			return;
		}

		if (!content && uploadedPhotos.length === 0) {
			toast.error("Please add some content or photos");
			return;
		}

		setSaving(true);
		const savedDate = date; // Store the date before reset
		try {
			const entryData: JournalEntry = {
				id: editingEntry?.id || crypto.randomUUID(),
				date,
				content: content || undefined,
				photos: uploadedPhotos.length > 0 ? uploadedPhotos : undefined,
				createdAt: editingEntry?.createdAt || new Date().toISOString(),
			};

			const res = await fetch("/api/journal", {
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

			// Reset form and reload entries for the saved date
			const today = getTodayDate();
			setDate(savedDate);
			setContent("");
			setUploadedPhotos([]);
			setEditingEntry(null);
			// Clear edit query parameter from URL
			const url = new URL(window.location.href);
			url.searchParams.delete("edit");
			router.replace(url.pathname + url.search, { scroll: false });
			// Reload entries for the date where we saved the entry
			await loadTodaysEntries(savedDate);
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
			const res = await fetch(`/api/journal?id=${entryId}`, {
				method: "DELETE",
			});

			if (!res.ok) throw new Error("Delete failed");

			toast.success("Entry deleted successfully!");
			if (editingEntry?.id === entryId) {
				// If we were editing this entry, reset form and reload entries for today
				const today = getTodayDate();
				setDate(today);
				setContent("");
				setUploadedPhotos([]);
				setEditingEntry(null);
				const url = new URL(window.location.href);
				url.searchParams.delete("edit");
				router.replace(url.pathname + url.search, { scroll: false });
				await loadTodaysEntries(today);
			} else {
				// Otherwise, just reload entries for current date
				await loadTodaysEntries(date);
			}
		} catch (err) {
			console.error("Delete error:", err);
			toast.error("Failed to delete entry");
		}
	}

	function editEntry(entry: JournalEntry) {
		setDate(entry.date);
		setContent(entry.content || "");
		setUploadedPhotos(entry.photos || []);
		setEditingEntry(entry);
		// Load entries for the entry's date
		loadTodaysEntries(entry.date);
	}

	function resetForm() {
		const today = getTodayDate();
		setDate(today);
		setContent("");
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
					<h1 className="text-3xl font-medium">Journal</h1>
					<Link
						href="/admin/journal/view"
						className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
					>
						View All Entries →
					</Link>
				</div>
				<p className="text-zinc-600 dark:text-zinc-400">
					Capture your thoughts, moments, and memories.
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

					<div>
						<label
							htmlFor="journal-date"
							className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
						>
							Date
						</label>
						<input
							id="journal-date"
							type="date"
							value={date}
							onChange={(e) => handleDateChange(e.target.value)}
							className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
						/>
					</div>

					<div>
						<label
							htmlFor="journal-content"
							className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
						>
							Your Thoughts
						</label>
						<textarea
							id="journal-content"
							value={content}
							onChange={(e) => setContent(e.target.value)}
							rows={8}
							placeholder="Write your thoughts, feelings, or anything on your mind..."
							className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
						/>
					</div>

					<PhotoUploader
						label="Photos (optional)"
						photos={uploadedPhotos}
						onChange={setUploadedPhotos}
						folder="journal"
						identifier={date.replace(/-/g, "")}
						onSuccess={(urls) =>
							toast.success(`${urls.length} photo(s) uploaded successfully`)
						}
						onError={() => toast.error("Failed to upload photos")}
					/>

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
				{/* Today's Entries */}
				<div className="space-y-4">
					<h2 className="text-xl font-medium">
						Entries for {formatDate(date)} ({todaysEntries.length})
					</h2>

					<div className="space-y-3">
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
										{entry.content && (
											<div className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
												{entry.content}
											</div>
										)}
										{entry.photos && entry.photos.length > 0 && (
											<div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">
												{entry.photos.map((photo) => (
													<img
														key={photo}
														src={photo}
														alt="Journal"
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
				</div>
			</motion.section>
		</motion.main>
	);
}

export default function AdminJournalPage() {
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
							<h1 className="text-3xl font-medium">Journal</h1>
						</div>
						<p className="text-zinc-600 dark:text-zinc-400">
							Loading...
						</p>
					</motion.section>
				</motion.main>
			}
		>
			<AdminJournalPageContent />
		</Suspense>
	);
}
