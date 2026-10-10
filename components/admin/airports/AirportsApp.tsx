"use client";

import {
	AdminPageWrapper,
	AdminSection,
} from "@/components/admin/AdminPageWrapper";
import { DateInput } from "@/components/admin/DateTimeInputs";
import { EmptyState } from "@/components/admin/EmptyState";
import { EntryCard, EntryCardList } from "@/components/admin/EntryCard";
import { FormActions } from "@/components/admin/FormActions";
import { TextArea, TextInput } from "@/components/admin/FormInputs";
import { PageHeader, SectionHeader } from "@/components/admin/PageHeader";
import PhotoField, { type DraftPhoto } from "@/components/admin/PhotoField";
import { adminRequest, groupBy } from "@/components/admin/client";
import {
	LibraryPhotoGrid,
	discardUploads,
	photosReady,
	toDrafts,
} from "@/components/admin/library-photos";
import airportsData from "@/data/airports.min.json";
import { formatDate } from "@/lib/date-utils";
import type { Airport } from "@/lib/models";
import { localDate } from "@/shared/common";
import { type Visit, visitListSchema } from "@/shared/visits";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

const airports = airportsData as Airport[];
const airportByIdent = new Map(airports.map((a) => [a.ident, a]));
const airportName = (ident: string) => {
	const airport = airportByIdent.get(ident);
	return airport ? `${airport.name} (${ident})` : ident;
};
const message = (error: unknown, fallback: string) =>
	error instanceof Error ? error.message : fallback;

export default function AirportsApp() {
	const [query, setQuery] = useState("");
	const [date, setDate] = useState(localDate);
	const [flightNumbers, setFlightNumbers] = useState<string[]>([""]);
	const [isLayover, setIsLayover] = useState(false);
	const [notes, setNotes] = useState("");
	const [selected, setSelected] = useState<Airport | null>(null);
	const [photos, setPhotos] = useState<DraftPhoto[]>([]);
	const [editing, setEditing] = useState<Visit | null>(null);
	const [visits, setVisits] = useState<Visit[]>([]);
	const [viewMode, setViewMode] = useState<"byDate" | "byAirport">("byDate");
	const [loading, setLoading] = useState(true);
	const [saving, setSaving] = useState(false);
	const formRef = useRef<HTMLDivElement>(null);

	const load = useCallback(async () => {
		setLoading(true);
		try {
			setVisits(visitListSchema.parse(await adminRequest("visits")).visits);
		} catch (error) {
			toast.error(message(error, "Failed to load visits"));
		} finally {
			setLoading(false);
		}
	}, []);
	useEffect(() => {
		void load();
	}, [load]);

	const lowered = query.toLowerCase();
	const results =
		query && !selected
			? airports
					.filter(
						(a) =>
							a.ident?.toLowerCase().includes(lowered) ||
							a.iata_code?.toLowerCase().includes(lowered) ||
							a.name?.toLowerCase().includes(lowered) ||
							a.municipality?.toLowerCase().includes(lowered),
					)
					.slice(0, 20)
			: [];

	function fill(visit: Visit | null) {
		const airport = visit ? airportByIdent.get(visit.airportIdent) : null;
		setEditing(visit);
		setSelected(airport ?? null);
		setQuery(airport?.name ?? visit?.airportIdent ?? "");
		setDate(visit?.date ?? localDate());
		setFlightNumbers(visit?.flightNumbers.length ? visit.flightNumbers : [""]);
		setIsLayover(visit?.isLayover ?? false);
		setNotes(visit?.notes ?? "");
		setPhotos(toDrafts(visit?.photos));
	}
	async function startOver(visit: Visit | null) {
		if (visit && !airportByIdent.has(visit.airportIdent)) {
			toast.error(
				`Could not find airport ${visit.airportIdent} in the local airport list.`,
			);
			return;
		}
		await discardUploads(photos);
		fill(visit);
		if (visit)
			requestAnimationFrame(() =>
				formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
			);
	}
	function changeLayover(checked: boolean) {
		setIsLayover(checked);
		if (checked && flightNumbers.length === 1)
			setFlightNumbers([flightNumbers[0], ""]);
		else if (!checked) setFlightNumbers([flightNumbers[0] ?? ""]);
	}

	async function save() {
		if (!selected) {
			toast.error("Select an airport");
			return;
		}
		if (!photosReady(photos)) {
			toast.error("Wait for photos to finish uploading");
			return;
		}
		setSaving(true);
		try {
			// Visit photos appear on the public airports map, as they did before.
			await Promise.all(
				photos
					.filter((item) => !item.existing)
					.map((item) =>
						adminRequest(`photos/${item.id}`, {
							method: "PATCH",
							body: JSON.stringify({ visibility: "public" }),
						}),
					),
			);
			await adminRequest(`visits/${editing?.id ?? crypto.randomUUID()}`, {
				method: "PUT",
				body: JSON.stringify({
					airportIdent: selected.ident,
					date,
					flightNumbers: flightNumbers
						.map((flight) => flight.trim())
						.filter(Boolean),
					isLayover,
					notes: notes.trim(),
					photoIds: photos.map((item) => item.id),
				}),
			});
			toast.success(editing ? "Visit updated" : "Visit saved");
			fill(null);
			await load();
		} catch (error) {
			toast.error(message(error, "Failed to save visit"));
		} finally {
			setSaving(false);
		}
	}
	async function remove(visit: Visit) {
		if (!window.confirm("Delete this visit?")) return;
		try {
			await adminRequest(`visits/${visit.id}`, { method: "DELETE" });
			toast.success("Visit deleted");
			if (editing?.id === visit.id) fill(null);
			await load();
		} catch (error) {
			toast.error(message(error, "Failed to delete visit"));
		}
	}

	const groups = useMemo(() => {
		const grouped = groupBy(visits, (visit) =>
			viewMode === "byDate" ? visit.date : visit.airportIdent,
		);
		const keys = Object.keys(grouped);
		if (viewMode === "byAirport")
			keys.sort((a, b) => airportName(a).localeCompare(airportName(b)));
		else keys.sort((a, b) => b.localeCompare(a));
		return keys.map((key) => [key, grouped[key]] as const);
	}, [visits, viewMode]);

	function card(visit: Visit) {
		const showAirport = viewMode === "byDate";
		const meta = [
			showAirport ? visit.airportIdent : null,
			showAirport ? null : formatDate(visit.date),
		]
			.filter(Boolean)
			.join(" ");
		return (
			<EntryCard
				onEdit={() => void startOver(visit)}
				onDelete={() => void remove(visit)}
				title={
					showAirport
						? (airportByIdent.get(visit.airportIdent)?.name ??
							visit.airportIdent)
						: null
				}
				meta={meta || null}
				body={
					<>
						{visit.flightNumbers.length > 0 && (
							<div className="mt-1">
								{visit.isLayover ? "Flights: " : "Flight: "}
								{visit.flightNumbers.join(" → ")}
							</div>
						)}
						{visit.notes && <div className="mt-1">{visit.notes}</div>}
					</>
				}
			>
				<LibraryPhotoGrid photos={visit.photos} />
			</EntryCard>
		);
	}

	return (
		<AdminPageWrapper>
			<PageHeader
				title="Manage Airport Visits"
				description="Add, edit, and manage your airport visits."
			/>
			<AdminSection>
				<div ref={formRef} className="scroll-mt-4 space-y-4">
					<SectionHeader title={editing ? "Edit Visit" : "Add New Visit"} />
					<div>
						<label
							htmlFor="airport-search"
							className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
						>
							Search Airport
						</label>
						<input
							id="airport-search"
							className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
							placeholder="Search by ICAO, IATA, name, or city..."
							value={query}
							onChange={(event) => {
								setQuery(event.target.value);
								setSelected(null);
							}}
						/>
						{results.length > 0 && (
							<div className="mt-2 max-h-64 overflow-auto rounded-lg border border-zinc-300 dark:border-zinc-700">
								{results.map((airport) => (
									<button
										type="button"
										key={airport.ident}
										className="w-full px-4 py-2 text-left text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
										onClick={() => {
											setSelected(airport);
											setQuery(airport.name);
										}}
									>
										<div className="font-medium">
											{airport.ident}
											{airport.iata_code ? ` (${airport.iata_code})` : ""}
										</div>
										<div className="text-zinc-600 dark:text-zinc-400">
											{airport.name} — {airport.municipality},{" "}
											{airport.iso_country}
										</div>
									</button>
								))}
							</div>
						)}
						{selected && (
							<div className="mt-2 rounded-lg bg-zinc-100 px-4 py-2 dark:bg-zinc-900/50">
								<div className="font-medium">Selected: {selected.name}</div>
								<div className="text-sm text-zinc-600 dark:text-zinc-400">
									{selected.ident}
									{selected.iata_code ? ` (${selected.iata_code})` : ""} —{" "}
									{selected.municipality}, {selected.iso_country}
								</div>
							</div>
						)}
					</div>
					<DateInput label="Visit Date" value={date} onChange={setDate} />
					<div>
						<div className="mb-3 flex items-center gap-3">
							<span className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
								Flight Information (optional)
							</span>
							<label
								htmlFor="layover-checkbox"
								className="flex items-center gap-2"
							>
								<input
									id="layover-checkbox"
									type="checkbox"
									checked={isLayover}
									onChange={(event) => changeLayover(event.target.checked)}
									className="rounded border-zinc-300 text-zinc-900 focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700"
								/>
								<span className="text-sm text-zinc-600 dark:text-zinc-400">
									Layover
								</span>
							</label>
						</div>
						{isLayover ? (
							<div className="space-y-2">
								{["Arrival Flight", "Departure Flight"].map((label, index) => (
									<TextInput
										key={label}
										label={label}
										value={flightNumbers[index] ?? ""}
										onChange={(value) =>
											setFlightNumbers((current) => {
												const next = [...current];
												next[index] = value;
												return next;
											})
										}
										placeholder={index ? "e.g., THY 35" : "e.g., THY 717"}
									/>
								))}
							</div>
						) : (
							<TextInput
								value={flightNumbers[0] ?? ""}
								onChange={(value) => setFlightNumbers([value])}
								placeholder="e.g., THY 36"
							/>
						)}
					</div>
					<TextArea
						label="Notes (optional)"
						value={notes}
						onChange={setNotes}
						rows={3}
						placeholder="Add any notes about this visit..."
					/>
					<PhotoField
						photos={photos}
						onChange={setPhotos}
						disabled={saving || !selected}
					/>
					<FormActions
						saving={saving}
						isEditing={!!editing}
						onSave={save}
						onCancel={() => void startOver(null)}
						disabled={!selected || !date || !photosReady(photos)}
						saveLabel="Save Visit"
						saveEditLabel="Update Visit"
					/>
				</div>
			</AdminSection>

			<AdminSection className="space-y-4">
				<div className="flex items-center justify-between">
					<SectionHeader title="Visits" />
					<div className="flex gap-2">
						{(["byDate", "byAirport"] as const).map((mode) => (
							<button
								key={mode}
								type="button"
								onClick={() => setViewMode(mode)}
								className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
									viewMode === mode
										? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
										: "bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700"
								}`}
							>
								{mode === "byDate" ? "By Date" : "By Airport"}
							</button>
						))}
					</div>
				</div>
				{loading ? (
					<p className="py-8 text-center text-zinc-600 dark:text-zinc-400">
						Loading...
					</p>
				) : groups.length === 0 ? (
					<EmptyState message="No visits yet. Add your first airport visit!" />
				) : (
					<div className="space-y-6">
						{groups.map(([key, group]) => (
							<div key={key} className="space-y-3">
								<h3 className="py-2 text-lg font-medium text-zinc-700 dark:text-zinc-300">
									{viewMode === "byDate" ? formatDate(key) : airportName(key)} (
									{group.length})
								</h3>
								<EntryCardList>
									{group.map((visit) => (
										<div key={visit.id}>{card(visit)}</div>
									))}
								</EntryCardList>
							</div>
						))}
					</div>
				)}
			</AdminSection>
		</AdminPageWrapper>
	);
}
