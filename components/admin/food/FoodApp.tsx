"use client";

import {
	AdminPageWrapper,
	AdminSection,
} from "@/components/admin/AdminPageWrapper";
import { DateTimeInput } from "@/components/admin/DateTimeInputs";
import { EmptyState } from "@/components/admin/EmptyState";
import {
	EntryCard,
	EntryCardActionButton,
	EntryCardList,
} from "@/components/admin/EntryCard";
import {
	FoodAnalysisModal,
	type FoodAnalysisResult,
} from "@/components/admin/FoodAnalysisModal";
import { FoodDashboard } from "@/components/admin/FoodDashboard";
import { FormActions } from "@/components/admin/FormActions";
import { TextArea } from "@/components/admin/FormInputs";
import { PageHeader, SectionHeader } from "@/components/admin/PageHeader";
import PhotoField, { type DraftPhoto } from "@/components/admin/PhotoField";
import {
	type ViewMode,
	ViewModeToggle,
} from "@/components/admin/ViewModeToggle";
import { adminRequest, groupBy } from "@/components/admin/client";
import {
	LibraryPhotoGrid,
	discardUploads,
	photosReady,
	toDrafts,
} from "@/components/admin/library-photos";
import { formatDate, formatTime } from "@/lib/date-utils";
import { localDate } from "@/shared/common";
import { type FoodEntry, foodListSchema } from "@/shared/food";
import { Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";

const currentTime = () => new Date().toTimeString().slice(0, 5);
const timeOf = (iso: string) => new Date(iso).toTimeString().slice(0, 5);
const toResult = (entry: FoodEntry): FoodAnalysisResult => ({
	foodName: entry.aiFoodName ?? "",
	calories: entry.aiCalories ?? 0,
	proteinG: entry.aiProteinG ?? 0,
	carbsG: entry.aiCarbsG ?? 0,
	fatG: entry.aiFatG ?? 0,
	notes: entry.aiNotes ?? "",
});
const message = (error: unknown, fallback: string) =>
	error instanceof Error ? error.message : fallback;

export default function FoodApp({ editId }: { editId?: string }) {
	const router = useRouter();
	const [date, setDate] = useState(localDate);
	const [time, setTime] = useState(currentTime);
	const [description, setDescription] = useState("");
	const [photos, setPhotos] = useState<DraftPhoto[]>([]);
	const [editing, setEditing] = useState<FoodEntry | null>(null);
	const [viewMode, setViewMode] = useState<ViewMode>("date");
	const [entries, setEntries] = useState<FoodEntry[]>([]);
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const [analyzing, setAnalyzing] = useState<FoodEntry | null>(null);
	const [isAnalyzing, setIsAnalyzing] = useState(false);
	const [analysisResult, setAnalysisResult] =
		useState<FoodAnalysisResult | null>(null);

	const load = useCallback(async (mode: ViewMode, day: string) => {
		setLoading(true);
		try {
			const query = mode === "date" ? `?date=${day}` : "";
			setEntries(
				foodListSchema.parse(await adminRequest(`food${query}`)).entries,
			);
		} catch (error) {
			toast.error(message(error, "Failed to load food entries"));
		} finally {
			setLoading(false);
		}
	}, []);
	const reload = () => load(viewMode, date);

	function fill(entry: FoodEntry | null) {
		setEditing(entry);
		setDate(entry?.date ?? localDate());
		setTime(entry ? timeOf(entry.eatenAt) : currentTime());
		setDescription(entry?.description ?? "");
		setPhotos(toDrafts(entry?.photos));
	}
	// biome-ignore lint/correctness/useExhaustiveDependencies: fill only calls state setters.
	useEffect(() => {
		if (!editId) {
			void load("date", localDate());
			return;
		}
		adminRequest<FoodEntry>(`food/${editId}`)
			.then((entry) => {
				fill(entry);
				void load("date", entry.date);
			})
			.catch((error) => toast.error(message(error, "Entry not found")));
	}, [editId, load]);

	async function startOver(entry: FoodEntry | null) {
		await discardUploads(photos);
		fill(entry);
		if (editId) router.replace("/admin/food");
	}
	function changeDate(next: string) {
		setDate(next);
		if (viewMode === "date") void load("date", next);
	}
	function changeView(mode: ViewMode) {
		setViewMode(mode);
		void load(mode, date);
	}

	async function save() {
		if (!description.trim() && photos.length === 0) {
			toast.error("Add a description or photos");
			return;
		}
		if (!photosReady(photos)) {
			toast.error("Wait for photos to finish uploading");
			return;
		}
		const [hours, minutes] = time.split(":").map(Number);
		const [year, month, day] = date.split("-").map(Number);
		setSaving(true);
		try {
			await adminRequest(`food/${editing?.id ?? crypto.randomUUID()}`, {
				method: "PUT",
				body: JSON.stringify({
					date,
					eatenAt: new Date(year, month - 1, day, hours, minutes).toISOString(),
					description: description.trim(),
					photoIds: photos.map((item) => item.id),
				}),
			});
			toast.success(editing ? "Entry updated" : "Entry saved. Analyzing…");
			const savedDate = date;
			fill(null);
			setDate(savedDate);
			if (editId) router.replace("/admin/food");
			await load(viewMode, savedDate);
		} catch (error) {
			toast.error(message(error, "Failed to save entry"));
		} finally {
			setSaving(false);
		}
	}
	async function remove(entry: FoodEntry) {
		if (!window.confirm("Delete this food entry?")) return;
		try {
			await adminRequest(`food/${entry.id}`, { method: "DELETE" });
			toast.success("Entry deleted");
			if (editing?.id === entry.id) fill(null);
			await reload();
		} catch (error) {
			toast.error(message(error, "Failed to delete entry"));
		}
	}
	async function analyze(entry: FoodEntry) {
		setAnalyzing(entry);
		setIsAnalyzing(true);
		setAnalysisResult(null);
		try {
			const updated = await adminRequest<FoodEntry>(
				`food/${entry.id}/analyze`,
				{ method: "POST" },
			);
			setAnalysisResult(toResult(updated));
			setAnalyzing(updated);
			await reload();
		} catch (error) {
			toast.error(message(error, "Failed to analyze food entry"));
		} finally {
			setIsAnalyzing(false);
		}
	}
	function openAnalysis(entry: FoodEntry) {
		if (entry.aiFoodName) {
			setAnalysisResult(null);
			setAnalyzing(entry);
		} else void analyze(entry);
	}

	function card(entry: FoodEntry) {
		return (
			<EntryCard
				key={entry.id}
				meta={
					<div className="flex items-center gap-2">
						<span className="text-xs">{formatTime(entry.eatenAt)}</span>
						{entry.aiFoodName && (
							<span className="flex items-center gap-0.5 text-xs text-green-600 dark:text-green-400">
								<Sparkles className="h-3 w-3" />
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
						{entry.aiFoodName && (
							<div className="mt-2 flex flex-wrap gap-2 text-xs">
								<span className="rounded-full bg-green-100 px-2 py-0.5 text-green-700 dark:bg-green-900/30 dark:text-green-400">
									{entry.aiCalories} kcal
								</span>
								<span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
									P: {entry.aiProteinG}g
								</span>
								<span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
									C: {entry.aiCarbsG}g
								</span>
								<span className="rounded-full bg-rose-100 px-2 py-0.5 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400">
									F: {entry.aiFatG}g
								</span>
							</div>
						)}
					</>
				}
				actions={
					<div className="ml-4 flex flex-shrink-0 flex-col gap-2">
						<EntryCardActionButton
							onClick={() => openAnalysis(entry)}
							variant="success"
						>
							<span className="flex items-center gap-1">
								<Sparkles className="h-3 w-3" />
								{entry.aiFoodName ? "View Analysis" : "Analyze"}
							</span>
						</EntryCardActionButton>
						<EntryCardActionButton
							onClick={() => void startOver(entry)}
							variant="neutral"
						>
							Edit
						</EntryCardActionButton>
						<EntryCardActionButton
							onClick={() => void remove(entry)}
							variant="danger"
						>
							Delete
						</EntryCardActionButton>
					</div>
				}
			>
				<LibraryPhotoGrid photos={entry.photos} />
			</EntryCard>
		);
	}

	const byDate = Object.entries(groupBy(entries, (entry) => entry.date)).sort(
		([a], [b]) => b.localeCompare(a),
	);

	return (
		<AdminPageWrapper>
			<PageHeader
				title="Food Tracker"
				description="Track your daily food intake with photos and descriptions."
			/>
			<AdminSection className="space-y-4">
				<SectionHeader title={editing ? "Edit Entry" : "New Entry"} />
				<DateTimeInput
					dateId="food-date"
					timeId="food-time"
					dateValue={date}
					timeValue={time}
					onDateChange={changeDate}
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
				<PhotoField photos={photos} onChange={setPhotos} disabled={saving} />
				<FormActions
					saving={saving}
					isEditing={!!editing}
					onSave={save}
					onCancel={() => void startOver(null)}
					disabled={!date || !photosReady(photos)}
					saveLabel="Save Entry"
					saveEditLabel="Update Entry"
				/>
			</AdminSection>

			<AdminSection className="space-y-4">
				<div className="flex items-center justify-between">
					<SectionHeader title="Entries" />
					<ViewModeToggle
						viewMode={viewMode}
						onViewModeChange={changeView}
						allLabel="All Entries"
					/>
				</div>
				{loading ? (
					<p className="py-8 text-center text-zinc-600 dark:text-zinc-400">
						Loading...
					</p>
				) : viewMode === "date" ? (
					<div className="space-y-3">
						<h3 className="text-lg font-medium text-zinc-700 dark:text-zinc-300">
							{formatDate(date)} ({entries.length})
						</h3>
						<FoodDashboard entries={entries} />
						<EntryCardList>
							{entries.map(card)}
							{entries.length === 0 && (
								<EmptyState message="No entries for this day yet. Create your first one!" />
							)}
						</EntryCardList>
					</div>
				) : (
					<div className="space-y-6">
						{byDate.length === 0 && (
							<EmptyState message="No entries yet. Create your first one!" />
						)}
						{byDate.map(([day, dayEntries]) => (
							<div key={day} className="space-y-3">
								<div className="flex flex-col justify-between gap-2 py-2 sm:flex-row sm:items-center">
									<h3 className="text-lg font-medium text-zinc-700 dark:text-zinc-300">
										{formatDate(day)} ({dayEntries.length})
									</h3>
									<FoodDashboard entries={dayEntries} compact />
								</div>
								<EntryCardList>{dayEntries.map(card)}</EntryCardList>
							</div>
						))}
					</div>
				)}
			</AdminSection>

			<FoodAnalysisModal
				key={analyzing?.id}
				entry={analyzing}
				onClose={() => {
					setAnalyzing(null);
					setAnalysisResult(null);
				}}
				isAnalyzing={isAnalyzing}
				analysisResult={analysisResult}
				onAnalyze={(entry) => void analyze(entry)}
			/>
		</AdminPageWrapper>
	);
}
