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
import { Sparkles, X, Check } from "lucide-react";

interface FoodAnalysisResult {
	foodName: string;
	calories: number;
	proteinG: number;
	carbsG: number;
	fatG: number;
	notes: string;
	metadataId: string;
}

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
	const [analysisResult, setAnalysisResult] =
		useState<FoodAnalysisResult | null>(null);
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
		setAnalysisResult(null);
		setIsAnalyzing(true);

		try {
			const response = await fetch("/api/food/analyze", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					entryId: entry.id,
					description: entry.description,
					photos: entry.photos,
				}),
			});

			if (!response.ok) {
				const error = await response.json();
				throw new Error(error.error || "Failed to analyze entry");
			}

			const result: FoodAnalysisResult = await response.json();
			setAnalysisResult(result);

			// Reload entries to show updated AI data
			if (viewMode === "all") {
				await loadAllEntries();
			} else {
				await loadTodaysEntries(entry.date);
			}
		} catch (error) {
			console.error("Analysis error:", error);
			toast.error(
				error instanceof Error ? error.message : "Failed to analyze food entry",
			);
			setAnalyzingEntry(null);
		} finally {
			setIsAnalyzing(false);
		}
	}

	function closeAnalysisModal() {
		setAnalyzingEntry(null);
		setAnalysisResult(null);
		setIsAnalyzing(false);
	}

	function renderNutritionBadge(entry: FoodEntry) {
		if (!entry.aiFoodName) return null;

		return (
			<div className="mt-2 flex flex-wrap gap-2 text-xs">
				<span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
					{entry.aiCalories} kcal
				</span>
				<span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
					P: {entry.aiProteinG}g
				</span>
				<span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
					C: {entry.aiCarbsG}g
				</span>
				<span className="px-2 py-0.5 rounded-full bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
					F: {entry.aiFatG}g
				</span>
			</div>
		);
	}

	function renderEntryCard(entry: FoodEntry) {
		const hasAnalysis = !!entry.aiFoodName;

		return (
			<EntryCard
				key={entry.id}
				onEdit={() => editEntry(entry)}
				onDelete={() => deleteEntry(entry.id)}
				meta={
					<div className="flex items-center gap-2">
						<span className="text-xs">{formatTime(entry.createdAt)}</span>
						{hasAnalysis && (
							<span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-0.5">
								<Sparkles className="w-3 h-3" />
								{entry.aiFoodName}
							</span>
						)}
					</div>
				}
				body={
					<>
						{entry.description && (
							<div className="whitespace-pre-wrap">{entry.description}</div>
						)}
						{renderNutritionBadge(entry)}
					</>
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
								{hasAnalysis ? "Re-analyze" : "Analyze"}
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

						<div className="px-6 py-4 overflow-y-auto max-h-[calc(80vh-140px)]">
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

							{/* Loading State */}
							{isAnalyzing && (
								<div className="flex items-center justify-center gap-2 py-8 text-zinc-500">
									<div className="w-5 h-5 border-2 border-zinc-300 border-t-zinc-600 rounded-full animate-spin" />
									<span>Analyzing your food entry...</span>
								</div>
							)}

							{/* Analysis Result */}
							{analysisResult && (
								<div className="space-y-4">
									{/* Food Name */}
									<div>
										<h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
											{analysisResult.foodName}
										</h3>
									</div>

									{/* Nutrition Grid */}
									<div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
										<div className="p-3 rounded-lg bg-green-50 dark:bg-green-900/20 text-center">
											<div className="text-2xl font-bold text-green-700 dark:text-green-400">
												{analysisResult.calories}
											</div>
											<div className="text-xs text-green-600 dark:text-green-500">
												Calories
											</div>
										</div>
										<div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-center">
											<div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
												{analysisResult.proteinG}g
											</div>
											<div className="text-xs text-blue-600 dark:text-blue-500">
												Protein
											</div>
										</div>
										<div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-center">
											<div className="text-2xl font-bold text-amber-700 dark:text-amber-400">
												{analysisResult.carbsG}g
											</div>
											<div className="text-xs text-amber-600 dark:text-amber-500">
												Carbs
											</div>
										</div>
										<div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-900/20 text-center">
											<div className="text-2xl font-bold text-rose-700 dark:text-rose-400">
												{analysisResult.fatG}g
											</div>
											<div className="text-xs text-rose-600 dark:text-rose-500">
												Fat
											</div>
										</div>
									</div>

									{/* Notes */}
									<div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
										<h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
											Notes
										</h4>
										<p className="text-sm text-zinc-600 dark:text-zinc-400">
											{analysisResult.notes}
										</p>
									</div>
								</div>
							)}
						</div>

						<div className="border-t border-zinc-200 dark:border-zinc-700 px-6 py-3 flex items-center justify-between">
							{analysisResult && (
								<span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
									<Check className="w-4 h-4" />
									Saved to entry
								</span>
							)}
							<button
								type="button"
								onClick={closeAnalysisModal}
								className="px-4 py-2 text-sm font-medium rounded-lg bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 transition-colors ml-auto"
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
