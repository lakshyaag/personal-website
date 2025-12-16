"use client";

import { useState, useCallback, useMemo, useRef, Suspense } from "react";
import PhotoUploader from "@/components/admin/PhotoUploader";
import { DateTimeInput } from "@/components/admin/DateTimeInputs";
import { TextArea } from "@/components/admin/FormInputs";
import { FormActions } from "@/components/admin/FormActions";
import {
	EntryCard,
	EntryCardList,
	EntryCardActionButton,
} from "@/components/admin/EntryCard";
import { PageHeader, SectionHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/admin/EmptyState";
import {
	AdminPageWrapper,
	AdminSection,
} from "@/components/admin/AdminPageWrapper";
import { useRouter, useSearchParams } from "next/navigation";
import type { FoodEntry } from "@/lib/models";
import { toast } from "sonner";
import {
	formatDate,
	formatTime,
	getCurrentTime,
	getTodayDate,
} from "@/lib/date-utils";
import { useAdminCrud } from "@/hooks/useAdminCrud";
import { Sparkles, X } from "lucide-react";

function AdminFoodPageContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const editId = searchParams.get("edit");
	const initializedRef = useRef(false);

	const initialDate = useMemo(() => getTodayDate(), []);
	const initialTime = useMemo(() => getCurrentTime(), []);

	const [date, setDate] = useState(initialDate);
	const [time, setTime] = useState(initialTime);
	const [description, setDescription] = useState("");
	const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
	const [todaysEntries, setTodaysEntries] = useState<FoodEntry[]>([]);
	const [allEntriesGrouped, setAllEntriesGrouped] = useState<
		Record<string, FoodEntry[]>
	>({});
	const [viewMode, setViewMode] = useState<"date" | "all">("date");
	const [editingEntry, setEditingEntry] = useState<FoodEntry | null>(null);

	// AI Analysis state
	const [analyzingEntry, setAnalyzingEntry] = useState<FoodEntry | null>(null);
	const [analysisResult, setAnalysisResult] = useState<string>("");
	const [isAnalyzing, setIsAnalyzing] = useState(false);

	const { saving, loading, save, remove, loadByDate, loadGrouped, loadById } =
		useAdminCrud<FoodEntry>({
			endpoint: "/api/food",
			entityName: "food entry",
		});

	const loadTodaysEntries = useCallback(
		async (selectedDate: string) => {
			if (!selectedDate) return;
			const entries = await loadByDate(selectedDate);
			setTodaysEntries(entries);
		},
		[loadByDate],
	);

	const loadAllEntries = useCallback(async () => {
		const grouped = await loadGrouped();
		setAllEntriesGrouped(grouped);
	}, [loadGrouped]);

	const loadEntryForEdit = useCallback(
		async (entryId: string) => {
			const entry = await loadById(entryId);
			if (entry) {
				setDate(entry.date);
				const entryTime = new Date(entry.createdAt);
				const hours = String(entryTime.getHours()).padStart(2, "0");
				const minutes = String(entryTime.getMinutes()).padStart(2, "0");
				setTime(`${hours}:${minutes}`);
				setDescription(entry.description || "");
				setUploadedPhotos(entry.photos || []);
				setEditingEntry(entry);
				setViewMode("date");
				await loadTodaysEntries(entry.date);
			}
		},
		[loadById, loadTodaysEntries],
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

		if (!description && uploadedPhotos.length === 0) {
			toast.error("Please add a description or photos");
			return;
		}

		const savedDate = date;
		const [hours, minutes] = time.split(":");
		const dateTime = new Date(date);
		dateTime.setHours(
			Number.parseInt(hours, 10),
			Number.parseInt(minutes, 10),
			0,
			0,
		);

		const entryData: FoodEntry = {
			id: editingEntry?.id || crypto.randomUUID(),
			date,
			description: description || undefined,
			photos: uploadedPhotos.length > 0 ? uploadedPhotos : undefined,
			createdAt: dateTime.toISOString(),
		};

		const success = await save(entryData);
		if (success) {
			setDate(savedDate);
			setTime(getCurrentTime());
			setDescription("");
			setUploadedPhotos([]);
			setEditingEntry(null);
			clearEditParam();
			if (viewMode === "all") {
				await loadAllEntries();
			} else {
				await loadTodaysEntries(savedDate);
			}
		}
	}

	async function deleteEntry(entryId: string) {
		const success = await remove(entryId);
		if (success) {
			if (editingEntry?.id === entryId) {
				const today = getTodayDate();
				setDate(today);
				setTime(getCurrentTime());
				setDescription("");
				setUploadedPhotos([]);
				setEditingEntry(null);
				clearEditParam();
			}
			if (viewMode === "all") {
				await loadAllEntries();
			} else {
				await loadTodaysEntries(date);
			}
		}
	}

	function editEntry(entry: FoodEntry) {
		setDate(entry.date);
		const entryTime = new Date(entry.createdAt);
		const hours = String(entryTime.getHours()).padStart(2, "0");
		const minutes = String(entryTime.getMinutes()).padStart(2, "0");
		setTime(`${hours}:${minutes}`);
		setDescription(entry.description || "");
		setUploadedPhotos(entry.photos || []);
		setEditingEntry(entry);
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
		clearEditParam();
		loadTodaysEntries(today);
	}

	function clearEditParam() {
		const url = new URL(window.location.href);
		url.searchParams.delete("edit");
		router.replace(url.pathname + url.search, { scroll: false });
	}

	async function analyzeEntry(entry: FoodEntry) {
		if (!entry.description && (!entry.photos || entry.photos.length === 0)) {
			toast.error("This entry has no content to analyze");
			return;
		}

		setAnalyzingEntry(entry);
		setAnalysisResult("");
		setIsAnalyzing(true);

		try {
			const response = await fetch("/api/food/analyze", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					description: entry.description,
					photos: entry.photos,
				}),
			});

			if (!response.ok) {
				throw new Error("Failed to analyze entry");
			}

			const reader = response.body?.getReader();
			if (!reader) {
				throw new Error("No response body");
			}

			const decoder = new TextDecoder();
			let result = "";

			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				const chunk = decoder.decode(value, { stream: true });
				result += chunk;
				setAnalysisResult(result);
			}
		} catch (error) {
			console.error("Analysis error:", error);
			toast.error("Failed to analyze food entry");
			setAnalyzingEntry(null);
		} finally {
			setIsAnalyzing(false);
		}
	}

	function closeAnalysisModal() {
		setAnalyzingEntry(null);
		setAnalysisResult("");
		setIsAnalyzing(false);
	}

	function renderEntryCard(entry: FoodEntry) {
		return (
			<EntryCard
				key={entry.id}
				onEdit={() => editEntry(entry)}
				onDelete={() => deleteEntry(entry.id)}
				meta={<span className="text-xs">{formatTime(entry.createdAt)}</span>}
				body={
					entry.description ? (
						<div className="whitespace-pre-wrap">{entry.description}</div>
					) : null
				}
				photos={entry.photos}
				actions={
					<div className="flex flex-col gap-2 ml-4 flex-shrink-0">
						<EntryCardActionButton
							onClick={() => analyzeEntry(entry)}
							variant="success"
						>
							<span className="flex items-center gap-1">
								<Sparkles className="w-3 h-3" />
								Analyze
							</span>
						</EntryCardActionButton>
						<EntryCardActionButton
							onClick={() => editEntry(entry)}
							variant="neutral"
						>
							Edit
						</EntryCardActionButton>
						<EntryCardActionButton
							onClick={() => deleteEntry(entry.id)}
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
			<PageHeader
				title="Food Tracker"
				description="Track your daily food intake with photos and descriptions."
			/>

			<AdminSection className="space-y-8">
				<div className="space-y-4">
					<SectionHeader title={editingEntry ? "Edit Entry" : "New Entry"} />

					<DateTimeInput
						dateId="food-date"
						timeId="food-time"
						dateValue={date}
						timeValue={time}
						onDateChange={handleDateChange}
						onTimeChange={setTime}
					/>

					<TextArea
						id="food-description"
						label="Description"
						value={description}
						onChange={setDescription}
						rows={4}
						placeholder="What did you eat? (e.g., Grilled chicken salad with avocado and olive oil)"
					/>

					<PhotoUploader
						label="Photos (optional)"
						photos={uploadedPhotos}
						onChange={setUploadedPhotos}
						folder="food"
						identifier={date.replace(/-/g, "")}
						onSuccess={(urls) =>
							toast.success(`${urls.length} photo(s) uploaded successfully`)
						}
						onError={() => toast.error("Failed to upload photos")}
					/>

					<FormActions
						saving={saving}
						isEditing={!!editingEntry}
						onSave={saveEntry}
						onCancel={resetForm}
						disabled={!date}
						saveLabel="Save Entry"
						saveEditLabel="Update Entry"
					/>
				</div>
			</AdminSection>

			<AdminSection>
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<SectionHeader title="Entries" />
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

					{loading && (
						<p className="text-center text-zinc-600 dark:text-zinc-400 py-8">
							Loading...
						</p>
					)}

					{!loading && viewMode === "date" && (
						<div className="space-y-3">
							<h3 className="text-lg font-medium text-zinc-700 dark:text-zinc-300">
								{formatDate(date)} ({todaysEntries.length})
							</h3>
							<EntryCardList>
								{todaysEntries.map(renderEntryCard)}
								{todaysEntries.length === 0 && (
									<EmptyState message="No entries for this day yet. Create your first one!" />
								)}
							</EntryCardList>
						</div>
					)}

					{!loading && viewMode === "all" && (
						<div className="space-y-6">
							{Object.keys(allEntriesGrouped).length === 0 && (
								<EmptyState message="No entries yet. Create your first one!" />
							)}
							{Object.keys(allEntriesGrouped)
								.sort((a, b) => b.localeCompare(a))
								.map((entryDate) => (
									<div key={entryDate} className="space-y-3">
										<h3 className="text-lg font-medium text-zinc-700 dark:text-zinc-300 sticky top-0 bg-white dark:bg-zinc-950 py-2">
											{formatDate(entryDate)} (
											{allEntriesGrouped[entryDate].length})
										</h3>
										<EntryCardList>
											{allEntriesGrouped[entryDate].map(renderEntryCard)}
										</EntryCardList>
									</div>
								))}
						</div>
					)}
				</div>
			</AdminSection>

			{/* AI Analysis Modal */}
			{analyzingEntry && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
					<div className="relative w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-xl bg-white dark:bg-zinc-900 shadow-2xl">
						<div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700 px-6 py-4">
							<div className="flex items-center gap-2">
								<Sparkles className="w-5 h-5 text-green-600 dark:text-green-400" />
								<h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
									AI Nutritional Analysis
								</h2>
							</div>
							<button
								type="button"
								onClick={closeAnalysisModal}
								className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
							>
								<X className="w-5 h-5 text-zinc-500" />
							</button>
						</div>

						<div className="px-6 py-4 overflow-y-auto max-h-[calc(80vh-120px)]">
							{/* Entry Summary */}
							<div className="mb-4 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
								<p className="text-sm text-zinc-600 dark:text-zinc-400">
									<span className="font-medium">Analyzing:</span>{" "}
									{analyzingEntry.description || "Photo(s) only"}
								</p>
								{analyzingEntry.photos && analyzingEntry.photos.length > 0 && (
									<p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
										{analyzingEntry.photos.length} photo(s) included
									</p>
								)}
							</div>

							{/* Analysis Result */}
							<div className="prose prose-sm dark:prose-invert max-w-none">
								{isAnalyzing && !analysisResult && (
									<div className="flex items-center gap-2 text-zinc-500">
										<div className="w-4 h-4 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
										<span>Analyzing your food entry...</span>
									</div>
								)}
								{analysisResult && (
									<div className="whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">
										{analysisResult}
									</div>
								)}
								{isAnalyzing && analysisResult && (
									<span className="inline-block w-2 h-4 bg-zinc-400 animate-pulse ml-0.5" />
								)}
							</div>
						</div>

						<div className="border-t border-zinc-200 dark:border-zinc-700 px-6 py-3 flex justify-end">
							<button
								type="button"
								onClick={closeAnalysisModal}
								className="px-4 py-2 text-sm font-medium rounded-lg bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 transition-colors"
							>
								Close
							</button>
						</div>
					</div>
				</div>
			)}
		</AdminPageWrapper>
	);
}

export default function AdminFoodPage() {
	return (
		<Suspense
			fallback={
				<AdminPageWrapper>
					<PageHeader title="Food Tracker" description="Loading..." />
				</AdminPageWrapper>
			}
		>
			<AdminFoodPageContent />
		</Suspense>
	);
}
