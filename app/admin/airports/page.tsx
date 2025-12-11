"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import PhotoUploader from "@/components/admin/PhotoUploader";
import { DateInput } from "@/components/admin/DateTimeInputs";
import { TextInput, TextArea } from "@/components/admin/FormInputs";
import { FormActions } from "@/components/admin/FormActions";
import { EntryCard, EntryCardList } from "@/components/admin/EntryCard";
import { PageHeader, SectionHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/admin/EmptyState";
import {
	AdminPageWrapper,
	AdminSection,
} from "@/components/admin/AdminPageWrapper";
import { useAdminCrud } from "@/hooks/useAdminCrud";
import { formatDate, getTodayDate } from "@/lib/date-utils";
import airportsData from "@/data/airports.min.json";
import type { Visit, Airport } from "@/lib/models";

type AirportViewMode = "byDate" | "byAirport";

export default function AdminAirportsPage() {
	const [query, setQuery] = useState("");
	const [date, setDate] = useState("");
	const [flightNumbers, setFlightNumbers] = useState<string[]>([""]);
	const [isLayover, setIsLayover] = useState(false);
	const [notes, setNotes] = useState("");
	const [selectedAirport, setSelectedAirport] = useState<Airport | null>(null);
	const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
	const [editingVisit, setEditingVisit] = useState<Visit | null>(null);
	const [allVisitsGrouped, setAllVisitsGrouped] = useState<
		Record<string, Visit[]>
	>({});
	const [viewMode, setViewMode] = useState<AirportViewMode>("byDate");

	const showDropdown = query && !selectedAirport;
	const results: Airport[] = showDropdown
		? (airportsData as Airport[])
				.filter(
					(a) =>
						a.ident?.toLowerCase().includes(query.toLowerCase()) ||
						a.iata_code?.toLowerCase().includes(query.toLowerCase()) ||
						a.name?.toLowerCase().includes(query.toLowerCase()) ||
						a.municipality?.toLowerCase().includes(query.toLowerCase()),
				)
				.slice(0, 20)
		: [];

	const { saving, loading, save, remove, loadByDate, loadGrouped, loadAll } =
		useAdminCrud<Visit>({
			endpoint: "/api/visits",
			entityName: "visit",
			useAlert: true,
		});

	const loadAllVisitsByDate = useCallback(async () => {
		const grouped = await loadGrouped();
		setAllVisitsGrouped(grouped);
	}, [loadGrouped]);

	const loadAllVisitsByAirport = useCallback(async () => {
		const allVisits = await loadAll();
		// Group by airport
		const grouped: Record<string, Visit[]> = {};
		for (const visit of allVisits) {
			if (!grouped[visit.airportIdent]) {
				grouped[visit.airportIdent] = [];
			}
			grouped[visit.airportIdent].push(visit);
		}
		// Sort visits within each airport by date (most recent first)
		for (const key of Object.keys(grouped)) {
			grouped[key].sort(
				(a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
			);
		}
		setAllVisitsGrouped(grouped);
	}, [loadAll]);

	useEffect(() => {
		const today = getTodayDate();
		setDate(today);
		loadAllVisitsByDate();
	}, [loadAllVisitsByDate]);

	const handleDateChange = useCallback((newDate: string) => {
		setDate(newDate);
	}, []);

	const handleViewModeChange = useCallback(
		(mode: AirportViewMode) => {
			setViewMode(mode);
			if (mode === "byDate") {
				loadAllVisitsByDate();
			} else if (mode === "byAirport") {
				loadAllVisitsByAirport();
			}
		},
		[loadAllVisitsByDate, loadAllVisitsByAirport],
	);

	async function saveVisit() {
		if (!selectedAirport || !date) {
			alert("Please select an airport and date");
			return;
		}

		const savedDate = date;
		const filteredFlightNumbers = flightNumbers.filter(
			(fn) => fn.trim() !== "",
		);
		const visitData: Visit = {
			id: editingVisit?.id || crypto.randomUUID(),
			airportIdent: selectedAirport.ident,
			date,
			flightNumbers:
				filteredFlightNumbers.length > 0 ? filteredFlightNumbers : undefined,
			isLayover: isLayover || undefined,
			notes: notes || undefined,
			photos: uploadedPhotos.length > 0 ? uploadedPhotos : undefined,
		};

		const success = await save(visitData);
		if (success) {
			resetForm();
			if (viewMode === "byDate") {
				await loadAllVisitsByDate();
			} else if (viewMode === "byAirport") {
				await loadAllVisitsByAirport();
			}
		}
	}

	async function deleteVisit(visitId: string) {
		const success = await remove(visitId);
		if (success) {
			if (editingVisit?.id === visitId) {
				resetForm();
			}
			if (viewMode === "byDate") {
				await loadAllVisitsByDate();
			} else if (viewMode === "byAirport") {
				await loadAllVisitsByAirport();
			}
		}
	}

	function editVisit(visit: Visit) {
		const airport = (airportsData as Airport[]).find(
			(a) => a.ident === visit.airportIdent,
		);
		if (!airport) return;

		setSelectedAirport(airport);
		setDate(visit.date);
		setFlightNumbers(
			visit.flightNumbers && visit.flightNumbers.length > 0
				? visit.flightNumbers
				: [""],
		);
		setIsLayover(visit.isLayover || false);
		setNotes(visit.notes || "");
		setUploadedPhotos(visit.photos || []);
		setEditingVisit(visit);
		setQuery(airport.name);
	}

	function resetForm() {
		setQuery("");
		const today = getTodayDate();
		setDate(today);
		setFlightNumbers([""]);
		setIsLayover(false);
		setNotes("");
		setSelectedAirport(null);
		setUploadedPhotos([]);
		setEditingVisit(null);
	}

	function handleLayoverChange(checked: boolean) {
		setIsLayover(checked);
		if (checked && flightNumbers.length === 1) {
			setFlightNumbers(["", ""]);
		} else if (!checked && flightNumbers.length > 1) {
			setFlightNumbers([flightNumbers[0] || ""]);
		}
	}

	function renderVisitCard(visit: Visit, showDate = true, showAirport = true) {
		const airport = (airportsData as Airport[]).find(
			(a) => a.ident === visit.airportIdent,
		);
		return (
			<EntryCard
				onEdit={() => editVisit(visit)}
				onDelete={() => deleteVisit(visit.id)}
			>
				{showAirport && (
					<div className="font-medium">
						{airport?.name || visit.airportIdent}
					</div>
				)}
				<div className="text-sm text-zinc-600 dark:text-zinc-400">
					{showAirport && `${visit.airportIdent} `}
					{showDate && formatDate(visit.date)}
				</div>
				{visit.flightNumbers && visit.flightNumbers.length > 0 && (
					<div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
						{visit.isLayover ? "Flights: " : "Flight: "}
						{visit.flightNumbers.join(" → ")}
					</div>
				)}
				{visit.notes && (
					<div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
						{visit.notes}
					</div>
				)}
				{visit.photos && visit.photos.length > 0 && (
					<div className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
						{visit.photos.length} photo
						{visit.photos.length > 1 ? "s" : ""}
					</div>
				)}
			</EntryCard>
		);
	}

	// Get airport name for header
	const getAirportName = useCallback((ident: string) => {
		const airport = (airportsData as Airport[]).find((a) => a.ident === ident);
		return airport ? `${airport.name} (${ident})` : ident;
	}, []);

	// Sort grouped entries by airport name or by date
	const sortedGroupKeys = useMemo(() => {
		const keys = Object.keys(allVisitsGrouped);
		if (viewMode === "byAirport") {
			return keys.sort((a, b) =>
				getAirportName(a).localeCompare(getAirportName(b)),
			);
		}
		// By date - sort descending
		return keys.sort((a, b) => b.localeCompare(a));
	}, [allVisitsGrouped, viewMode, getAirportName]);

	return (
		<AdminPageWrapper>
			<PageHeader
				title="Manage Airport Visits"
				description="Add, edit, and manage your airport visits."
			/>

			<AdminSection className="space-y-8">
				<div className="space-y-4">
					<SectionHeader
						title={editingVisit ? "Edit Visit" : "Add New Visit"}
					/>

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
							onChange={(e) => {
								setQuery(e.target.value);
								if (selectedAirport) setSelectedAirport(null);
							}}
						/>

						{showDropdown && results.length > 0 && (
							<div className="mt-2 max-h-64 overflow-auto rounded-lg border border-zinc-300 dark:border-zinc-700">
								{results.map((airport) => (
									<button
										type="button"
										key={airport.ident}
										className="w-full px-4 py-2 text-left text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
										onClick={() => {
											setSelectedAirport(airport);
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

						{selectedAirport && (
							<div className="mt-2 rounded-lg bg-zinc-100 px-4 py-2 dark:bg-zinc-900/50">
								<div className="font-medium">
									Selected: {selectedAirport.name}
								</div>
								<div className="text-sm text-zinc-600 dark:text-zinc-400">
									{selectedAirport.ident}
									{selectedAirport.iata_code
										? ` (${selectedAirport.iata_code})`
										: ""}{" "}
									— {selectedAirport.municipality},{" "}
									{selectedAirport.iso_country}
								</div>
							</div>
						)}
					</div>

					<DateInput
						label="Visit Date"
						value={date}
						onChange={handleDateChange}
					/>

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
									onChange={(e) => handleLayoverChange(e.target.checked)}
									className="rounded border-zinc-300 text-zinc-900 focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700"
								/>
								<span className="text-sm text-zinc-600 dark:text-zinc-400">
									Layover
								</span>
							</label>
						</div>

						{isLayover ? (
							<div className="space-y-2">
								<TextInput
									label="Arrival Flight"
									value={flightNumbers[0] || ""}
									onChange={(value) => {
										const newFlights = [...flightNumbers];
										newFlights[0] = value;
										setFlightNumbers(newFlights);
									}}
									placeholder="e.g., THY 717"
								/>
								<TextInput
									label="Departure Flight"
									value={flightNumbers[1] || ""}
									onChange={(value) => {
										const newFlights = [...flightNumbers];
										newFlights[1] = value;
										setFlightNumbers(newFlights);
									}}
									placeholder="e.g., THY 35"
								/>
							</div>
						) : (
							<TextInput
								value={flightNumbers[0] || ""}
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

					<PhotoUploader
						label="Photos (optional)"
						photos={uploadedPhotos}
						onChange={setUploadedPhotos}
						folder="airports"
						identifier={selectedAirport?.ident ?? ""}
						disabled={!selectedAirport}
						onError={() => alert("Failed to upload photos")}
					/>

					<FormActions
						saving={saving}
						isEditing={!!editingVisit}
						onSave={saveVisit}
						onCancel={resetForm}
						disabled={!selectedAirport || !date}
						saveLabel="Save Visit"
						saveEditLabel="Update Visit"
					/>
				</div>
			</AdminSection>

			<AdminSection>
				<div className="space-y-4">
					<div className="flex items-center justify-between">
						<SectionHeader title="Visits" />
						<div className="flex gap-2">
							{(["byDate", "byAirport"] as const).map((mode) => (
								<button
									key={mode}
									type="button"
									onClick={() => handleViewModeChange(mode)}
									className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
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

					{loading && (
						<p className="text-center text-zinc-600 dark:text-zinc-400 py-8">
							Loading...
						</p>
					)}

					{!loading && viewMode === "byDate" && (
						<div className="space-y-6">
							{sortedGroupKeys.length === 0 ? (
								<EmptyState message="No visits yet. Add your first airport visit!" />
							) : (
								sortedGroupKeys.map((groupDate) => (
									<div key={groupDate} className="space-y-3">
										<h3 className="text-lg font-medium text-zinc-700 dark:text-zinc-300 sticky top-0 bg-white dark:bg-zinc-950 py-2">
											{formatDate(groupDate)} (
											{allVisitsGrouped[groupDate].length})
										</h3>
										<EntryCardList>
											{allVisitsGrouped[groupDate].map((visit) => (
												<div key={visit.id}>
													{renderVisitCard(visit, false, true)}
												</div>
											))}
										</EntryCardList>
									</div>
								))
							)}
						</div>
					)}

					{!loading && viewMode === "byAirport" && (
						<div className="space-y-6">
							{sortedGroupKeys.length === 0 ? (
								<EmptyState message="No visits yet. Add your first airport visit!" />
							) : (
								sortedGroupKeys.map((airportIdent) => (
									<div key={airportIdent} className="space-y-3">
										<h3 className="text-lg font-medium text-zinc-700 dark:text-zinc-300 sticky top-0 bg-white dark:bg-zinc-950 py-2">
											{getAirportName(airportIdent)} (
											{allVisitsGrouped[airportIdent].length})
										</h3>
										<EntryCardList>
											{allVisitsGrouped[airportIdent].map((visit) => (
												<div key={visit.id}>
													{renderVisitCard(visit, true, false)}
												</div>
											))}
										</EntryCardList>
									</div>
								))
							)}
						</div>
					)}
				</div>
			</AdminSection>
		</AdminPageWrapper>
	);
}
