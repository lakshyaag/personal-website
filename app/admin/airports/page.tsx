"use client";

import { useState, useEffect } from "react";
import PhotoUploader from "@/components/admin/PhotoUploader";
import { DateInput } from "@/components/admin/DateTimeInputs";
import { TextInput, TextArea, CheckboxInput } from "@/components/admin/FormInputs";
import { FormActions } from "@/components/admin/FormActions";
import { EntryCard, EntryCardList } from "@/components/admin/EntryCard";
import { PageHeader, SectionHeader } from "@/components/admin/PageHeader";
import { EmptyState } from "@/components/admin/EmptyState";
import {
	AdminPageWrapper,
	AdminSection,
} from "@/components/admin/AdminPageWrapper";
import { useAdminCrud } from "@/hooks/useAdminCrud";
import airports from "@/data/airports.min.json";
import type { Visit, Airport } from "@/lib/models";

export default function AdminAirportsPage() {
	const [query, setQuery] = useState("");
	const [date, setDate] = useState("");
	const [flightNumbers, setFlightNumbers] = useState<string[]>([""]);
	const [isLayover, setIsLayover] = useState(false);
	const [notes, setNotes] = useState("");
	const [selectedAirport, setSelectedAirport] = useState<Airport | null>(null);
	const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
	const [editingVisit, setEditingVisit] = useState<Visit | null>(null);

	const showDropdown = query && !selectedAirport;
	const results: Airport[] = showDropdown
		? (airports as Airport[])
				.filter(
					(a) =>
						a.ident?.toLowerCase().includes(query.toLowerCase()) ||
						a.iata_code?.toLowerCase().includes(query.toLowerCase()) ||
						a.name?.toLowerCase().includes(query.toLowerCase()) ||
						a.municipality?.toLowerCase().includes(query.toLowerCase()),
				)
				.slice(0, 20)
		: [];

	const { items: visits, saving, loadAll, save, remove } = useAdminCrud<Visit>({
		endpoint: "/api/visits",
		entityName: "visit",
		useAlert: true,
	});

	useEffect(() => {
		loadAll();
	}, [loadAll]);

	async function saveVisit() {
		if (!selectedAirport || !date) {
			alert("Please select an airport and date");
			return;
		}

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
			await loadAll();
		}
	}

	async function deleteVisit(visitId: string) {
		const success = await remove(visitId);
		if (success) {
			await loadAll();
			if (editingVisit?.id === visitId) {
				resetForm();
			}
		}
	}

	function editVisit(visit: Visit) {
		const airport = (airports as Airport[]).find(
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
		setDate("");
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

	return (
		<AdminPageWrapper>
			<PageHeader
				title="Manage Airport Visits"
				description="Add, edit, and manage your airport visits."
			/>

			<AdminSection className="space-y-8">
				<div className="space-y-4">
					<SectionHeader title={editingVisit ? "Edit Visit" : "Add New Visit"} />

					<div>
						<label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
							Search Airport
						</label>
						<input
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

					<DateInput label="Visit Date" value={date} onChange={setDate} />

					<div>
						<div className="mb-3 flex items-center gap-3">
							<label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
								Flight Information (optional)
							</label>
							<label className="flex items-center gap-2">
								<input
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
					<SectionHeader title="Existing Visits" count={visits.length} />

					<EntryCardList>
						{visits
							.sort(
								(a, b) =>
									new Date(b.date).getTime() - new Date(a.date).getTime(),
							)
							.map((visit) => {
								const airport = (airports as Airport[]).find(
									(a) => a.ident === visit.airportIdent,
								);
								return (
									<EntryCard
										key={visit.id}
										onEdit={() => editVisit(visit)}
										onDelete={() => deleteVisit(visit.id)}
									>
										<div className="font-medium">
											{airport?.name || visit.airportIdent}
										</div>
										<div className="text-sm text-zinc-600 dark:text-zinc-400">
											{visit.airportIdent} — {visit.date}
										</div>
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
							})}

						{visits.length === 0 && (
							<EmptyState message="No visits yet. Add your first airport visit!" />
						)}
					</EntryCardList>
				</div>
			</AdminSection>
		</AdminPageWrapper>
	);
}
