"use client";

import { DateInput } from "@/components/admin/DateTimeInputs";
import {
	CheckboxInput,
	TextArea,
	TextInput,
	fieldClass,
} from "@/components/admin/FormInputs";
import PhotoField, { type DraftPhoto } from "@/components/admin/PhotoField";
import { adminRequest, groupBy } from "@/components/admin/client";
import {
	AdminPage,
	EditorSheet,
	EmptyState,
	Fab,
	GroupHeader,
	ListStatus,
	RecordCard,
	Segmented,
	message,
	useAdminList,
	useUndoDelete,
} from "@/components/admin/kit";
import {
	LibraryPhotoGrid,
	discardUploads,
	photosReady,
	samePhotos,
	toDrafts,
} from "@/components/admin/library-photos";
import airportsData from "@/data/airports.min.json";
import { formatDate } from "@/lib/date-utils";
import type { Airport } from "@/lib/public-types";
import { localDate } from "@/shared/common";
import { type Visit, visitListSchema } from "@/shared/visits";
import { useState } from "react";
import { toast } from "sonner";

const airports = airportsData as Airport[];
const airportByIdent = new Map(airports.map((a) => [a.ident, a]));
const airportName = (ident: string) => {
	const airport = airportByIdent.get(ident);
	return airport ? `${airport.name} (${ident})` : ident;
};
const parse = (data: unknown) => visitListSchema.parse(data).visits;
const views = [
	{ value: "date", label: "By date" },
	{ value: "airport", label: "By airport" },
] as const;

export default function AirportsApp() {
	const [view, setView] = useState<"date" | "airport">("date");
	const list = useAdminList("visits", parse);
	const { hidden, remove } = useUndoDelete();
	const [editor, setEditor] = useState<{ visit: Visit | null } | null>(null);

	const visits = list.items.filter((visit) => !hidden.has(visit.id));
	const grouped = groupBy(visits, (visit) =>
		view === "date" ? visit.date : visit.airportIdent,
	);
	const keys = Object.keys(grouped).sort((a, b) =>
		view === "date"
			? b.localeCompare(a)
			: airportName(a).localeCompare(airportName(b)),
	);

	return (
		<AdminPage
			title="Airports"
			actions={
				<Segmented
					label="Group"
					value={view}
					options={views}
					onChange={setView}
				/>
			}
		>
			<ListStatus
				loading={list.loading}
				error={list.error}
				onRetry={list.reload}
			/>
			{!list.loading && !list.error && keys.length === 0 && (
				<EmptyState>No visits yet.</EmptyState>
			)}
			{keys.map((key) => (
				<section key={key} className="space-y-3">
					<GroupHeader>
						{view === "date" ? formatDate(key) : airportName(key)}
					</GroupHeader>
					{grouped[key].map((visit) => (
						<RecordCard
							key={visit.id}
							label={`Edit visit to ${visit.airportIdent} on ${visit.date}`}
							onOpen={() => setEditor({ visit })}
							media={<LibraryPhotoGrid photos={visit.photos} />}
						>
							<div className="font-medium">
								{view === "date"
									? (airportByIdent.get(visit.airportIdent)?.name ??
										visit.airportIdent)
									: formatDate(visit.date)}
							</div>
							{visit.flightNumbers.length > 0 && (
								<div className="mt-1 text-zinc-600 dark:text-zinc-400">
									{visit.isLayover ? "Flights: " : "Flight: "}
									{visit.flightNumbers.join(" → ")}
								</div>
							)}
							{visit.notes && (
								<div className="mt-1 text-zinc-600 dark:text-zinc-400">
									{visit.notes}
								</div>
							)}
						</RecordCard>
					))}
				</section>
			))}
			<Fab label="Add visit" onClick={() => setEditor({ visit: null })} />
			{editor && (
				<VisitEditor
					key={editor.visit?.id ?? "new"}
					visit={editor.visit}
					onClose={() => setEditor(null)}
					onSaved={() => {
						setEditor(null);
						list.reload();
					}}
					onDelete={(visit) => {
						setEditor(null);
						remove(visit.id, "Visit deleted", `visits/${visit.id}`);
					}}
				/>
			)}
		</AdminPage>
	);
}

function AirportSearch({
	selected,
	onSelect,
}: {
	selected: Airport | null;
	onSelect: (airport: Airport | null) => void;
}) {
	const [query, setQuery] = useState(selected?.name ?? "");
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
	return (
		<div>
			<label
				htmlFor="airport-search"
				className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
			>
				Search Airport
			</label>
			<input
				id="airport-search"
				className={fieldClass}
				placeholder="ICAO, IATA, name or city"
				value={query}
				onChange={(event) => {
					setQuery(event.target.value);
					onSelect(null);
				}}
			/>
			{results.length > 0 && (
				<div className="mt-2 max-h-64 overflow-auto rounded-lg border border-zinc-300 dark:border-zinc-700">
					{results.map((airport) => (
						<button
							type="button"
							key={airport.ident}
							className="w-full px-3 py-2.5 text-left text-sm active:bg-zinc-100 dark:active:bg-zinc-800"
							onClick={() => {
								onSelect(airport);
								setQuery(airport.name);
							}}
						>
							<div className="font-medium">
								{airport.ident}
								{airport.iata_code ? ` (${airport.iata_code})` : ""}
							</div>
							<div className="text-zinc-600 dark:text-zinc-400">
								{airport.name} — {airport.municipality}, {airport.iso_country}
							</div>
						</button>
					))}
				</div>
			)}
			{selected && (
				<p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
					{selected.ident}
					{selected.iata_code ? ` (${selected.iata_code})` : ""} —{" "}
					{selected.municipality}, {selected.iso_country}
				</p>
			)}
		</div>
	);
}

function VisitEditor({
	visit,
	onClose,
	onSaved,
	onDelete,
}: {
	visit: Visit | null;
	onClose: () => void;
	onSaved: () => void;
	onDelete: (visit: Visit) => void;
}) {
	const [initial] = useState(() => ({
		airport: visit ? (airportByIdent.get(visit.airportIdent) ?? null) : null,
		date: visit?.date ?? localDate(),
		flights: visit?.flightNumbers.length ? visit.flightNumbers : [""],
		isLayover: visit?.isLayover ?? false,
		notes: visit?.notes ?? "",
	}));
	const [form, setForm] = useState(initial);
	const [photos, setPhotos] = useState<DraftPhoto[]>(() =>
		toDrafts(visit?.photos),
	);
	const [saving, setSaving] = useState(false);
	const dirty =
		JSON.stringify(form) !== JSON.stringify(initial) ||
		!samePhotos(photos, visit?.photos);

	async function discardAnd(then: () => void) {
		await discardUploads(photos);
		then();
	}
	function setLayover(isLayover: boolean) {
		setForm({
			...form,
			isLayover,
			flights: isLayover
				? [form.flights[0] ?? "", ""]
				: [form.flights[0] ?? ""],
		});
	}
	function setFlight(index: number, value: string) {
		const flights = [...form.flights];
		flights[index] = value;
		setForm({ ...form, flights });
	}
	async function save() {
		if (!form.airport) return;
		setSaving(true);
		try {
			// The Worker makes visit photos public on the airports map.
			await adminRequest(`visits/${visit?.id ?? crypto.randomUUID()}`, {
				method: "PUT",
				body: JSON.stringify({
					airportIdent: form.airport.ident,
					date: form.date,
					flightNumbers: form.flights.map((f) => f.trim()).filter(Boolean),
					isLayover: form.isLayover,
					notes: form.notes.trim(),
					photoIds: photos.map((item) => item.id),
				}),
			});
			toast.success(visit ? "Visit updated" : "Visit saved");
			onSaved();
		} catch (error) {
			toast.error(message(error, "Failed to save visit"));
			setSaving(false);
		}
	}

	return (
		<EditorSheet
			title={visit ? "Edit visit" : "Add visit"}
			onClose={() => void discardAnd(onClose)}
			onSubmit={() => void save()}
			onDelete={
				visit ? () => void discardAnd(() => onDelete(visit)) : undefined
			}
			saving={saving}
			dirty={dirty}
			canSubmit={Boolean(form.airport && form.date) && photosReady(photos)}
		>
			<AirportSearch
				selected={form.airport}
				onSelect={(airport) => setForm((current) => ({ ...current, airport }))}
			/>
			<DateInput
				label="Visit Date"
				value={form.date}
				onChange={(date) => setForm({ ...form, date })}
			/>
			<CheckboxInput
				label="Layover"
				checked={form.isLayover}
				onChange={setLayover}
			/>
			{form.isLayover ? (
				<div className="grid grid-cols-2 gap-3">
					<TextInput
						label="Arrival Flight"
						value={form.flights[0] ?? ""}
						onChange={(value) => setFlight(0, value)}
						placeholder="THY 717"
					/>
					<TextInput
						label="Departure Flight"
						value={form.flights[1] ?? ""}
						onChange={(value) => setFlight(1, value)}
						placeholder="THY 35"
					/>
				</div>
			) : (
				<TextInput
					label="Flight (optional)"
					value={form.flights[0] ?? ""}
					onChange={(value) => setFlight(0, value)}
					placeholder="THY 36"
				/>
			)}
			<TextArea
				label="Notes (optional)"
				value={form.notes}
				onChange={(notes) => setForm({ ...form, notes })}
				rows={3}
			/>
			<PhotoField photos={photos} onChange={setPhotos} disabled={saving} />
		</EditorSheet>
	);
}
