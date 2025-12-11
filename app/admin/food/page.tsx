"use client";

import { useState, useCallback, useMemo, useRef, Suspense } from "react";
import PhotoUploader from "@/components/admin/PhotoUploader";
import { DateTimeInput } from "@/components/admin/DateTimeInputs";
import { TextArea } from "@/components/admin/FormInputs";
import { FormActions } from "@/components/admin/FormActions";
import { EntryCard, EntryCardList } from "@/components/admin/EntryCard";
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

	const { saving, loading, save, remove, loadByDate, loadGrouped, loadById } =
		useAdminCrud<FoodEntry>({
			endpoint: "/api/food",
			entityName: "entry",
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
