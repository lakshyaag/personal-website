"use client";

import { DateInput } from "@/components/admin/DateTimeInputs";
import {
	SelectInput,
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
	message,
	secondaryButton,
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
import {
	type Flight,
	type FlightLookup,
	cabins,
	chronological,
	connects,
	flightCode,
	flightListSchema,
	flightLookupSchema,
	seatTypes,
} from "@/shared/flights";
import { useMemo, useState } from "react";
import { toast } from "sonner";

const airports = airportsData as Airport[];
const airportByIdent = new Map(airports.map((a) => [a.ident, a]));
/** "YYZ", or the ICAO code for airports without an IATA code. */
const short = (ident: string) => airportByIdent.get(ident)?.iata_code || ident;
const parse = (data: unknown) => flightListSchema.parse(data).flights;
const label = (value: string) => value[0].toUpperCase() + value.slice(1);
/** "AC 590" → its airline prefix and number. */
const splitCode = (value: string) =>
	value
		.trim()
		.toUpperCase()
		.match(/^([A-Z0-9]{2,3}?)\s*(\d{1,4}[A-Z]?)$/);

type Draft = Partial<Flight> & { from?: string; to?: string };

export default function FlightsApp() {
	const list = useAdminList("flights", parse);
	const { hidden, remove } = useUndoDelete();
	const [editor, setEditor] = useState<{
		flight: Flight | null;
		draft?: Draft;
	} | null>(null);

	const flights = list.items.filter((flight) => !hidden.has(flight.id));
	// Which flights continue the one before them (a layover), for the "Connection" marker.
	const connecting = useMemo(() => {
		const ordered = chronological(flights);
		return new Set(
			ordered
				.filter((flight, i) => i > 0 && connects(ordered[i - 1], flight))
				.map((flight) => flight.id),
		);
	}, [flights]);
	const grouped = groupBy(flights, (flight) => flight.date.slice(0, 4));
	const years = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

	return (
		<AdminPage title="Flights">
			<ListStatus
				loading={list.loading}
				error={list.error}
				onRetry={list.reload}
			/>
			{!list.loading && !list.error && years.length === 0 && (
				<EmptyState>No flights yet.</EmptyState>
			)}
			{years.map((year) => (
				<section key={year} className="space-y-3">
					<GroupHeader>
						{year} · {grouped[year].length} flights
					</GroupHeader>
					{grouped[year].map((flight) => (
						<RecordCard
							key={flight.id}
							label={`Edit ${flightCode(flight)} on ${flight.date}`}
							onOpen={() => setEditor({ flight })}
							media={<LibraryPhotoGrid photos={flight.photos} />}
						>
							<div className="flex items-center gap-2 font-medium">
								<span>
									{flightCode(flight)} · {short(flight.from)} →{" "}
									{short(flight.to)}
								</span>
								{connecting.has(flight.id) && (
									<span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
										Connection
									</span>
								)}
							</div>
							<div className="mt-1 text-zinc-600 dark:text-zinc-400">
								{[
									formatDate(flight.date),
									flight.aircraft,
									flight.registration,
									flight.seat && `Seat ${flight.seat}`,
								]
									.filter(Boolean)
									.join(" · ")}
							</div>
						</RecordCard>
					))}
				</section>
			))}
			<Fab label="Add flight" onClick={() => setEditor({ flight: null })} />
			{editor && (
				<FlightEditor
					key={editor.flight?.id ?? `new-${editor.draft?.from ?? ""}`}
					flight={editor.flight}
					draft={editor.draft}
					onClose={() => setEditor(null)}
					onSaved={() => {
						setEditor(null);
						list.reload();
					}}
					onDelete={(flight) => {
						setEditor(null);
						remove(flight.id, "Flight deleted", `flights/${flight.id}`);
					}}
					onNextLeg={(flight) =>
						setEditor({
							flight: null,
							draft: {
								from: flight.to,
								date: flight.arrivesAt?.slice(0, 10) ?? flight.date,
							},
						})
					}
				/>
			)}
		</AdminPage>
	);
}

function AirportSearch({
	label,
	selected,
	onSelect,
}: {
	label: string;
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
	const id = `airport-${label.toLowerCase()}`;
	return (
		<div>
			<label
				htmlFor={id}
				className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
			>
				{label}
			</label>
			<input
				id={id}
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

function FlightEditor({
	flight,
	draft,
	onClose,
	onSaved,
	onDelete,
	onNextLeg,
}: {
	flight: Flight | null;
	draft?: Draft;
	onClose: () => void;
	onSaved: () => void;
	onDelete: (flight: Flight) => void;
	onNextLeg: (flight: Flight) => void;
}) {
	const source = flight ?? draft;
	const [initial] = useState(() => ({
		code: flight ? flightCode(flight) : "",
		date: source?.date ?? localDate(),
		from: source?.from ? (airportByIdent.get(source.from) ?? null) : null,
		to: source?.to ? (airportByIdent.get(source.to) ?? null) : null,
		airlineIcao: flight?.airlineIcao ?? "",
		airlineIata: flight?.airlineIata ?? "",
		airlineName: flight?.airlineName ?? "",
		departsAt: flight?.departsAt ?? null,
		arrivesAt: flight?.arrivesAt ?? null,
		aircraft: flight?.aircraft ?? "",
		registration: flight?.registration ?? "",
		seat: flight?.seat ?? "",
		seatType: flight?.seatType ?? "",
		cabin: flight?.cabin ?? "",
		notes: flight?.notes ?? "",
	}));
	const [form, setForm] = useState(initial);
	// Remounts the airport pickers when a lookup fills them in.
	const [pickerKey, setPickerKey] = useState(0);
	const [photos, setPhotos] = useState<DraftPhoto[]>(() =>
		toDrafts(flight?.photos),
	);
	const [saving, setSaving] = useState(false);
	const [lookingUp, setLookingUp] = useState(false);
	const [candidates, setCandidates] = useState<FlightLookup["candidates"]>([]);
	const dirty =
		JSON.stringify(form) !== JSON.stringify(initial) ||
		!samePhotos(photos, flight?.photos);
	const parts = splitCode(form.code);
	// A typed code fills in whichever airline code is still empty.
	const airlineIcao =
		form.airlineIcao || (parts?.[1].length === 3 ? parts[1] : "");
	const airlineIata =
		form.airlineIata || (parts?.[1].length === 2 ? parts[1] : "");

	async function discardAnd(then: () => void) {
		await discardUploads(photos);
		then();
	}
	function apply(candidate: FlightLookup["candidates"][number]) {
		setForm((current) => ({
			...current,
			code: `${candidate.airlineIata ?? candidate.airlineIcao ?? ""} ${candidate.flightNumber}`,
			date: candidate.date,
			from: airportByIdent.get(candidate.from) ?? current.from,
			to: airportByIdent.get(candidate.to) ?? current.to,
			airlineIcao: candidate.airlineIcao ?? "",
			airlineIata: candidate.airlineIata ?? "",
			airlineName: candidate.airlineName ?? "",
			departsAt: candidate.departsAt,
			arrivesAt: candidate.arrivesAt,
			aircraft: candidate.aircraft ?? current.aircraft,
			registration: candidate.registration ?? current.registration,
		}));
		setPickerKey((key) => key + 1);
		setCandidates([]);
	}
	async function lookUp() {
		setLookingUp(true);
		try {
			const { candidates } = flightLookupSchema.parse(
				await adminRequest(
					`flights/lookup?${new URLSearchParams({ number: form.code, date: form.date })}`,
				),
			);
			if (candidates.length === 1) apply(candidates[0]);
			else if (candidates.length) setCandidates(candidates);
			else toast.error("No flight found. Fill it in by hand.");
		} catch (error) {
			toast.error(message(error, "Lookup failed"));
		} finally {
			setLookingUp(false);
		}
	}
	async function save() {
		if (!form.from || !form.to || !parts) return;
		setSaving(true);
		try {
			// The Worker makes flight photos public on the airports page.
			await adminRequest(`flights/${flight?.id ?? crypto.randomUUID()}`, {
				method: "PUT",
				body: JSON.stringify({
					date: form.date,
					airlineIcao: airlineIcao || null,
					airlineIata: airlineIata || null,
					airlineName: form.airlineName,
					flightNumber: parts[2],
					from: form.from.ident,
					to: form.to.ident,
					departsAt: form.departsAt,
					arrivesAt: form.arrivesAt,
					aircraft: form.aircraft,
					registration: form.registration,
					seat: form.seat,
					seatType: form.seatType || null,
					cabin: form.cabin || null,
					notes: form.notes,
					photoIds: photos.map((item) => item.id),
				}),
			});
			toast.success(flight ? "Flight updated" : "Flight saved");
			onSaved();
		} catch (error) {
			toast.error(message(error, "Failed to save flight"));
			setSaving(false);
		}
	}
	const times = [
		form.departsAt && `Departs ${form.departsAt.replace("T", " ")}`,
		form.arrivesAt && `arrives ${form.arrivesAt.replace("T", " ")}`,
	].filter(Boolean);

	return (
		<EditorSheet
			title={flight ? "Edit flight" : "Add flight"}
			onClose={() => void discardAnd(onClose)}
			onSubmit={() => void save()}
			onDelete={
				flight ? () => void discardAnd(() => onDelete(flight)) : undefined
			}
			saving={saving}
			dirty={dirty}
			canSubmit={
				Boolean(
					parts &&
						(airlineIcao || airlineIata) &&
						form.from &&
						form.to &&
						form.from.ident !== form.to.ident &&
						form.date,
				) && photosReady(photos)
			}
		>
			<div className="grid grid-cols-2 gap-3">
				<TextInput
					label="Flight"
					value={form.code}
					onChange={(code) => setForm({ ...form, code })}
					placeholder="AC 590"
				/>
				<DateInput
					label="Date"
					value={form.date}
					onChange={(date) => setForm({ ...form, date })}
				/>
			</div>
			<div>
				<button
					type="button"
					className={`${secondaryButton} w-full`}
					disabled={!parts || !form.date || lookingUp || saving}
					onClick={() => void lookUp()}
				>
					{lookingUp ? "Looking up…" : "Look up route, times and aircraft"}
				</button>
				{candidates.length > 0 && (
					<div className="mt-2 space-y-2">
						<p className="text-sm text-zinc-600 dark:text-zinc-400">
							This number flies several legs. Pick yours:
						</p>
						{candidates.map((candidate) => (
							<button
								type="button"
								key={`${candidate.from}-${candidate.to}`}
								className={`${secondaryButton} w-full text-left`}
								onClick={() => apply(candidate)}
							>
								{short(candidate.from)} → {short(candidate.to)}
								{candidate.departsAt && ` · ${candidate.departsAt.slice(11)}`}
							</button>
						))}
					</div>
				)}
				{times.length > 0 && (
					<p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
						{times.join(", ")} (local)
					</p>
				)}
			</div>
			<AirportSearch
				key={`from-${pickerKey}`}
				label="From"
				selected={form.from}
				onSelect={(from) => setForm((current) => ({ ...current, from }))}
			/>
			<AirportSearch
				key={`to-${pickerKey}`}
				label="To"
				selected={form.to}
				onSelect={(to) => setForm((current) => ({ ...current, to }))}
			/>
			<div className="grid grid-cols-[1fr_1fr_2fr] gap-3">
				<TextInput
					label="ICAO"
					value={airlineIcao}
					onChange={(value) => setForm({ ...form, airlineIcao: value })}
					placeholder="ACA"
				/>
				<TextInput
					label="IATA"
					value={airlineIata}
					onChange={(value) => setForm({ ...form, airlineIata: value })}
					placeholder="AC"
				/>
				<TextInput
					label="Airline"
					value={form.airlineName}
					onChange={(airlineName) => setForm({ ...form, airlineName })}
					placeholder="Air Canada"
				/>
			</div>
			<div className="grid grid-cols-2 gap-3">
				<TextInput
					label="Aircraft"
					value={form.aircraft}
					onChange={(aircraft) => setForm({ ...form, aircraft })}
					placeholder="Boeing 787-9"
				/>
				<TextInput
					label="Registration"
					value={form.registration}
					onChange={(registration) => setForm({ ...form, registration })}
					placeholder="C-FRSO"
				/>
			</div>
			<div className="grid grid-cols-3 gap-3">
				<TextInput
					label="Seat"
					value={form.seat}
					onChange={(seat) => setForm({ ...form, seat })}
					placeholder="23A"
				/>
				<SelectInput
					label="Position"
					value={form.seatType}
					onChange={(seatType) => setForm({ ...form, seatType })}
					options={[
						{ value: "", label: "—" },
						...seatTypes.map((value) => ({ value, label: label(value) })),
					]}
				/>
				<SelectInput
					label="Cabin"
					value={form.cabin}
					onChange={(cabin) => setForm({ ...form, cabin })}
					options={[
						{ value: "", label: "—" },
						...cabins.map((value) => ({ value, label: label(value) })),
					]}
				/>
			</div>
			<TextArea
				label="Notes (private)"
				value={form.notes}
				onChange={(notes) => setForm({ ...form, notes })}
				rows={3}
			/>
			<PhotoField photos={photos} onChange={setPhotos} disabled={saving} />
			{flight && (
				<button
					type="button"
					className={`${secondaryButton} w-full`}
					disabled={saving}
					onClick={() => void discardAnd(() => onNextLeg(flight))}
				>
					Add next leg from {short(flight.to)}
				</button>
			)}
		</EditorSheet>
	);
}
