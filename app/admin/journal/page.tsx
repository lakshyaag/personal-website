"use client";

import { useState, useCallback, useMemo, useRef, Suspense } from "react";
import PhotoUploader from "@/components/admin/PhotoUploader";
import { DateInput } from "@/components/admin/DateTimeInputs";
import { TextArea } from "@/components/admin/FormInputs";
import { FormActions } from "@/components/admin/FormActions";
import { EntryCard, EntryCardList } from "@/components/admin/EntryCard";
import { PageHeader, SectionHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/admin/EmptyState";
import {
	AdminPageWrapper,
	AdminSection,
} from "@/components/admin/AdminPageWrapper";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { JournalEntry } from "@/lib/models";
import { toast } from "sonner";
import { formatDate, formatTime, getTodayDate } from "@/lib/date-utils";
import { useAdminCrud } from "@/hooks/useAdminCrud";

function AdminJournalPageContent() {
	const router = useRouter();
	const searchParams = useSearchParams();
	const editId = searchParams.get("edit");
	const initializedRef = useRef(false);

	const initialDate = useMemo(() => getTodayDate(), []);

	const [date, setDate] = useState(initialDate);
	const [content, setContent] = useState("");
	const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
	const [todaysEntries, setTodaysEntries] = useState<JournalEntry[]>([]);
	const [editingEntry, setEditingEntry] = useState<JournalEntry | null>(null);

	const { saving, save, remove, loadByDate, loadById } =
		useAdminCrud<JournalEntry>({
			endpoint: "/api/journal",
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

	const loadEntryForEdit = useCallback(
		async (entryId: string) => {
			const entry = await loadById(entryId);
			if (entry) {
				setDate(entry.date);
				setContent(entry.content || "");
				setUploadedPhotos(entry.photos || []);
				setEditingEntry(entry);
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

		if (!content && uploadedPhotos.length === 0) {
			toast.error("Please add some content or photos");
			return;
		}

		const savedDate = date;
		const entryData: JournalEntry = {
			id: editingEntry?.id || crypto.randomUUID(),
			date,
			content: content || undefined,
			photos: uploadedPhotos.length > 0 ? uploadedPhotos : undefined,
			createdAt: editingEntry?.createdAt || new Date().toISOString(),
		};

		const success = await save(entryData);
		if (success) {
			setDate(savedDate);
			setContent("");
			setUploadedPhotos([]);
			setEditingEntry(null);
			clearEditParam();
			await loadTodaysEntries(savedDate);
		}
	}

	async function deleteEntry(entryId: string) {
		const success = await remove(entryId);
		if (success) {
			if (editingEntry?.id === entryId) {
				const today = getTodayDate();
				setDate(today);
				setContent("");
				setUploadedPhotos([]);
				setEditingEntry(null);
				clearEditParam();
				await loadTodaysEntries(today);
			} else {
				await loadTodaysEntries(date);
			}
		}
	}

	function editEntry(entry: JournalEntry) {
		setDate(entry.date);
		setContent(entry.content || "");
		setUploadedPhotos(entry.photos || []);
		setEditingEntry(entry);
		loadTodaysEntries(entry.date);
	}

	function resetForm() {
		const today = getTodayDate();
		setDate(today);
		setContent("");
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

	return (
		<AdminPageWrapper>
			<PageHeader
				title="Journal"
				description="Capture your thoughts, moments, and memories."
				actions={
					<Link
						href="/admin/journal/view"
						className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
					>
						View All Entries →
					</Link>
				}
			/>

			<AdminSection className="space-y-8">
				<div className="space-y-4">
					<SectionHeader title={editingEntry ? "Edit Entry" : "New Entry"} />

					<DateInput
						id="journal-date"
						label="Date"
						value={date}
						onChange={handleDateChange}
					/>

					<TextArea
						id="journal-content"
						label="Your Thoughts"
						value={content}
						onChange={setContent}
						rows={8}
						placeholder="Write your thoughts, feelings, or anything on your mind..."
					/>

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
					<SectionHeader
						title={`Entries for ${formatDate(date)}`}
						count={todaysEntries.length}
					/>

					<EntryCardList>
						{todaysEntries.map((entry) => (
							<EntryCard
								key={entry.id}
								onEdit={() => editEntry(entry)}
								onDelete={() => deleteEntry(entry.id)}
							>
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
												onKeyDown={() => window.open(photo, "_blank")}
											/>
										))}
									</div>
								)}
							</EntryCard>
						))}

						{todaysEntries.length === 0 && (
							<EmptyState message="No entries for this day yet. Create your first one!" />
						)}
					</EntryCardList>
				</div>
			</AdminSection>
		</AdminPageWrapper>
	);
}

export default function AdminJournalPage() {
	return (
		<Suspense
			fallback={
				<AdminPageWrapper>
					<PageHeader title="Journal" description="Loading..." />
				</AdminPageWrapper>
			}
		>
			<AdminJournalPageContent />
		</Suspense>
	);
}
