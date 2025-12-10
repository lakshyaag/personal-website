"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import airports from "@/data/airports.min.json";
import type { Visit, Airport } from "@/lib/models";
import {
	VARIANTS_CONTAINER,
	VARIANTS_SECTION,
	TRANSITION_SECTION,
} from "@/lib/utils";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormDateInput, FormTextarea } from "@/components/admin/form-fields";
import { EmptyState, LoadingText } from "@/components/admin/loading-states";
import { usePhotoUpload } from "@/hooks/use-photo-upload";
import { useAdminCrud } from "@/hooks/use-admin-crud";

export default function AdminAirportsPage() {
	const { ConfirmDialog, confirm } = useConfirmDialog();

	const [query, setQuery] = useState("");
	const [selectedAirport, setSelectedAirport] = useState<Airport | null>(null);

	const {
		items: visits,
		formData,
		editing,
		loading,
		saving,
		updateField,
		updateFields,
		saveItem,
		deleteItem,
		editItem,
		resetForm,
		loadItems,
	} = useAdminCrud<Visit>({
		endpoint: "/api/visits",
		entityName: "visit",
		initialFormData: {
			airportIdent: "",
			date: "",
			flightNumbers: [],
			isLayover: false,
			notes: "",
			photos: [],
		},
		toApi: (data) => {
			const filteredFlights =
				data.flightNumbers?.filter((fn) => fn.trim() !== "") || [];
			return {
				id: data.id,
				airportIdent: data.airportIdent,
				date: data.date,
				flightNumbers:
					filteredFlights.length > 0 ? filteredFlights : undefined,
				isLayover: data.isLayover || undefined,
				notes: data.notes || undefined,
				photos:
					data.photos && data.photos.length > 0 ? data.photos : undefined,
			};
		},
		fromApi: (data) => {
			const visit = data as Visit;
			return {
				...visit,
				flightNumbers: visit.flightNumbers ?? [],
				notes: visit.notes ?? "",
				photos: visit.photos ?? [],
				isLayover: visit.isLayover ?? false,
			};
		},
	});

	const {
		photos,
		uploading,
		uploadPhotos,
		removePhoto,
		setPhotosList,
	} = usePhotoUpload({
		folder: "airports",
		identifier: selectedAirport?.ident || "temp",
		initialPhotos: formData.photos || [],
		onPhotosChange: (newPhotos) => updateField("photos", newPhotos),
	});

	useEffect(() => {
		setPhotosList(formData.photos || []);
	}, [formData.photos, setPhotosList]);

	useEffect(() => {
		loadItems();
	}, [loadItems]);

	const showDropdown = query && !selectedAirport;
	const results: Airport[] = showDropdown
		? (airports as Airport[])
			.filter(
				(a) =>
					a.ident?.toLowerCase().includes(query.toLowerCase()) ||
					a.iata_code?.toLowerCase().includes(query.toLowerCase()) ||
					a.name?.toLowerCase().includes(query.toLowerCase()) ||
					a.municipality?.toLowerCase().includes(query.toLowerCase())
			)
			.slice(0, 20)
		: [];

	async function handlePhotoUpload(files: FileList | null) {
		if (!files || files.length === 0) return;
		if (!selectedAirport) {
			toast.error("Please select an airport first");
			return;
		}

		await uploadPhotos(files);
	}

	async function handleSave() {
		if (!selectedAirport || !formData.date) {
			toast.error("Please select an airport and date");
			return;
		}

		updateFields({ airportIdent: selectedAirport.ident });
		await saveItem();
		resetFormState();
		await loadItems();
	}

	async function handleDelete(visitId: string) {
		const confirmed = await confirm({
			title: "Delete Visit?",
			message: "This action cannot be undone.",
			variant: "danger",
			confirmLabel: "Delete",
		});

		if (!confirmed) return;

		await deleteItem(visitId);

		if (editing?.id === visitId) {
			resetFormState();
		}

		await loadItems();
	}

	function handleEdit(visit: Visit) {
		const airport = (airports as Airport[]).find(
			(a) => a.ident === visit.airportIdent
		);
		if (!airport) return;

		setSelectedAirport(airport);
		setQuery(airport.name);
		setPhotosList(visit.photos || []);

		editItem({
			...visit,
			flightNumbers: visit.flightNumbers ?? [],
			notes: visit.notes ?? "",
			photos: visit.photos ?? [],
			isLayover: visit.isLayover ?? false,
		});
	}

	function resetFormState() {
		resetForm();
		updateFields({
			airportIdent: "",
			date: "",
			flightNumbers: [],
			isLayover: false,
			notes: "",
			photos: [],
		});
		setSelectedAirport(null);
		setQuery("");
		setPhotosList([]);
	}

	return (
		<>
			<ConfirmDialog />
			<motion.main
				className="space-y-8 pb-16"
				variants={VARIANTS_CONTAINER}
				initial="hidden"
				animate="visible"
			>
				<motion.section
					variants={VARIANTS_SECTION}
					transition={TRANSITION_SECTION}
				>
					<h1 className="mb-4 text-3xl font-medium">Manage Airport Visits</h1>
					<p className="text-zinc-600 dark:text-zinc-400">
						Add, edit, and manage your airport visits.
					</p>
				</motion.section>

				<motion.section
					className="space-y-8"
					variants={VARIANTS_SECTION}
					transition={TRANSITION_SECTION}
				>
					<div className="space-y-4">
						<h2 className="text-xl font-medium">
							{editing ? "Edit Visit" : "Add New Visit"}
						</h2>

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
												updateField("airportIdent", airport.ident);
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

						<FormDateInput
							label="Visit Date"
							value={formData.date}
							onChange={(e) => updateField("date", e.target.value)}
						/>

						<div>
							<div className="mb-3 flex items-center gap-3">
								<label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
									Flight Information (optional)
								</label>
								<label className="flex items-center gap-2">
									<input
										type="checkbox"
										checked={formData.isLayover || false}
										onChange={(e) => {
											const checked = e.target.checked;
											updateField("isLayover", checked);
											const flights = formData.flightNumbers ?? [];
											if (checked && flights.length === 1) {
												updateField("flightNumbers", ["", ""]);
											} else if (!checked && flights.length > 1) {
												updateField("flightNumbers", [flights[0] || ""]);
											}
										}}
										className="rounded border-zinc-300 text-zinc-900 focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700"
									/>
									<span className="text-sm text-zinc-600 dark:text-zinc-400">
										Layover
									</span>
								</label>
							</div>

							{formData.isLayover ? (
								<div className="space-y-2">
									<div>
										<label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
											Arrival Flight
										</label>
										<input
											type="text"
											value={(formData.flightNumbers ?? [])[0] || ""}
											onChange={(e) => {
												const newFlights = [...(formData.flightNumbers ?? ["", ""])];
												newFlights[0] = e.target.value;
												updateField("flightNumbers", newFlights);
											}}
											placeholder="e.g., THY 717"
											className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
										/>
									</div>
									<div>
										<label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
											Departure Flight
										</label>
										<input
											type="text"
											value={(formData.flightNumbers ?? ["", ""])[1] || ""}
											onChange={(e) => {
												const newFlights = [...(formData.flightNumbers ?? ["", ""])];
												newFlights[1] = e.target.value;
												updateField("flightNumbers", newFlights);
											}}
											placeholder="e.g., THY 35"
											className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
										/>
									</div>
								</div>
							) : (
								<input
									type="text"
									value={(formData.flightNumbers ?? [])[0] || ""}
									onChange={(e) =>
										updateField("flightNumbers", [e.target.value])
									}
									placeholder="e.g., THY 36"
									className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
								/>
							)}
						</div>

						<FormTextarea
							label="Notes (optional)"
							value={formData.notes || ""}
							onChange={(e) => updateField("notes", e.target.value)}
							rows={3}
							placeholder="Add any notes about this visit..."
						/>

						<div>
							<label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
								Photos (optional)
							</label>
							<input
								type="file"
								accept="image/*"
								multiple
								onChange={(e) => handlePhotoUpload(e.target.files)}
								disabled={!selectedAirport || uploading}
								className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
							/>
							{uploading && (
								<p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
									Uploading...
								</p>
							)}
							{photos.length > 0 && (
								<div className="mt-2 grid grid-cols-3 gap-2">
									{photos.map((photo) => (
										<div key={photo} className="relative">
											<img
												src={photo}
												alt="Airport"
												className="h-24 w-full rounded object-cover"
											/>
											<button
												type="button"
												onClick={() => removePhoto(photo)}
												className="absolute right-1 top-1 rounded-full bg-red-500 px-2 py-1 text-xs text-white hover:bg-red-600"
											>
												×
											</button>
										</div>
									))}
								</div>
							)}
						</div>

						<div className="flex gap-2">
							<button
								type="button"
								onClick={handleSave}
								disabled={saving || !selectedAirport || !formData.date}
								className="rounded-lg bg-zinc-900 px-6 py-2 text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
							>
								{saving
									? "Saving..."
									: editing
										? "Update Visit"
										: "Save Visit"}
							</button>
							{editing && (
								<button
									type="button"
									onClick={resetFormState}
									className="rounded-lg border border-zinc-300 px-6 py-2 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
								>
									Cancel
								</button>
							)}
						</div>
					</div>
				</motion.section>

				<motion.section
					variants={VARIANTS_SECTION}
					transition={TRANSITION_SECTION}
				>
					<h2 className="mb-4 text-xl font-medium">
						Existing Visits ({visits.length})
					</h2>

					{loading ? (
						<LoadingText text="Loading visits..." />
					) : visits.length === 0 ? (
						<EmptyState
							title="No visits yet"
							message="Add your first airport visit above."
						/>
					) : (
						<div className="space-y-2">
							{visits
								.sort(
									(a, b) =>
										new Date(b.date).getTime() -
										new Date(a.date).getTime()
								)
								.map((visit) => {
									const airport = (airports as Airport[]).find(
										(a) => a.ident === visit.airportIdent
									);
									return (
										<div
											key={visit.id}
											className="rounded-lg border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/50"
										>
											<div className="mb-2 flex items-start justify-between">
												<div>
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
															📷 {visit.photos.length} photo
															{visit.photos.length > 1 ? "s" : ""}
														</div>
													)}
												</div>
												<div className="flex gap-2">
													<button
														type="button"
														onClick={() => handleEdit(visit)}
														className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
													>
														Edit
													</button>
													<button
														type="button"
														onClick={() => handleDelete(visit.id)}
														className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
													>
														Delete
													</button>
												</div>
											</div>
										</div>
									);
								})}
						</div>
					)}
				</motion.section>
			</motion.main>
		</>
	);
}
