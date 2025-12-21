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
import type { FitsEntry } from "@/lib/models";
import { toast } from "sonner";
import {
	formatDate,
	formatTime,
	getCurrentTime,
	getTodayDate,
} from "@/lib/date-utils";
import { useAdminCrud } from "@/hooks/useAdminCrud";

function AdminFitsPageContent() {
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
	const [todaysEntries, setTodaysEntries] = useState<FitsEntry[]>([]);
	const [allEntriesGrouped, setAllEntriesGrouped] = useState<
		Record<string, FitsEntry[]>
	>({});
	const [viewMode, setViewMode] = useState<"date" | "all">("date");
	const [editingEntry, setEditingEntry] = useState<FitsEntry | null>(null);

	const { saving, loading, save, remove, loadByDate, loadGrouped, loadById } =
		useAdminCrud<FitsEntry>({
			endpoint: "/api/fits",
			entityName: "fits entry",
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

		const entryData: FitsEntry = {
			id: editingEntry?.id || crypto.randomUUID(),
			date,
			description: description || undefined,
			photos: uploadedPhotos.length > 0 ? uploadedPhotos : undefined,
			createdAt: dateTime.toISOString(),
		};

		const successId = await save(entryData);
		if (successId) {
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

	function editEntry(entry: FitsEntry) {
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

	function renderEntryCard(entry: FitsEntry) {
		return (
			<EntryCard
				key={entry.id}
				onEdit={() => editEntry(entry)}
				onDelete={() => deleteEntry(entry.id)}
				meta={
					<div className="flex items-center gap-2">
						<span className="text-xs">{formatTime(entry.createdAt)}</span>
					</div>
				}
				body={
					entry.description && (
						<div className="whitespace-pre-wrap">{entry.description}</div>
					)
				}
				photos={entry.photos}
				actions={
					<div className="flex flex-col gap-2 ml-4 flex-shrink-0">
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
				title="Fits Tracker"
				description="Track your daily outfits with photos."
			/>

			<AdminSection className="space-y-8">
				<div className="space-y-4">
					<SectionHeader title={editingEntry ? "Edit Fit" : "New Fit"} />

					<DateTimeInput
						dateId="fits-date"
						timeId="fits-time"
						dateValue={date}
						timeValue={time}
						onDateChange={handleDateChange}
						onTimeChange={setTime}
					/>

					<TextArea
						id="fits-description"
						label="Description"
						value={description}
						onChange={setDescription}
						rows={4}
						placeholder="What are you wearing today? (e.g., Casual Friday: Navy blazer, white tee, light wash jeans)"
					/>

					<PhotoUploader
						label="Photos"
						photos={uploadedPhotos}
						onChange={setUploadedPhotos}
						folder="fits"
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
						saveLabel="Save Fit"
						saveEditLabel="Update Fit"
					/>
				</div>
			</AdminSection>

			<AdminSection>
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<SectionHeader title="Outfits" />
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
								All Fits
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
							<div className="flex flex-col gap-4">
								<h3 className="text-lg font-medium text-zinc-700 dark:text-zinc-300">
									{formatDate(date)} ({todaysEntries.length})
								</h3>
							</div>
							<EntryCardList>
								{todaysEntries.map(renderEntryCard)}
								{todaysEntries.length === 0 && (
									<EmptyState message="No fits for this day yet. Snap one!" />
								)}
							</EntryCardList>
						</div>
					)}

					{!loading && viewMode === "all" && (
						<div className="space-y-6">
							{Object.keys(allEntriesGrouped).length === 0 && (
								<EmptyState message="No entries yet. Snap your first fit!" />
							)}
							{Object.keys(allEntriesGrouped)
								.sort((a, b) => b.localeCompare(a))
								.map((entryDate) => (
									<div key={entryDate} className="space-y-3">
										<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sticky top-0 bg-white dark:bg-zinc-950 py-2 z-10">
											<h3 className="text-lg font-medium text-zinc-700 dark:text-zinc-300">
												{formatDate(entryDate)} (
												{allEntriesGrouped[entryDate].length})
											</h3>
										</div>
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

export default function AdminFitsPage() {
	return (
		<Suspense
			fallback={
				<AdminPageWrapper>
					<PageHeader title="Fits Tracker" description="Loading..." />
				</AdminPageWrapper>
			}
		>
			<AdminFitsPageContent />
		</Suspense>
	);
}
