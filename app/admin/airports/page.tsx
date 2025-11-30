"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import airports from "@/data/airports.min.json";
import type { Visit, Airport } from "@/lib/models";
import {
	VARIANTS_CONTAINER,
	VARIANTS_SECTION,
	TRANSITION_SECTION,
} from "@/lib/utils";

export default function AdminAirportsPage() {
	const [query, setQuery] = useState("");
	const [date, setDate] = useState("");
	const [flightNumbers, setFlightNumbers] = useState<string[]>([""]);
	const [isLayover, setIsLayover] = useState(false);
	const [notes, setNotes] = useState("");
	const [selectedAirport, setSelectedAirport] = useState<Airport | null>(null);
	const [uploadedPhotos, setUploadedPhotos] = useState<string[]>([]);
	const [uploading, setUploading] = useState(false);
	const [saving, setSaving] = useState(false);
	const [visits, setVisits] = useState<Visit[]>([]);
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

	useEffect(() => {
		loadVisits();
	}, []);

	async function loadVisits() {
		try {
			const res = await fetch("/api/visits");
			const data = await res.json();
			setVisits(data);
		} catch (err) {
			console.error("Failed to load visits:", err);
		}
	}

	async function handlePhotoUpload(files: FileList | null) {
		if (!files || files.length === 0) return;
		if (!selectedAirport) {
			alert("Please select an airport first");
			return;
		}

		setUploading(true);
		try {
			const urls: string[] = [];
			for (const file of Array.from(files)) {
				const form = new FormData();
				form.append("file", file);
				form.append("folder", "airports");
				form.append("identifier", selectedAirport.ident);

				const res = await fetch("/api/upload", {
					method: "POST",
					body: form,
				});

				if (!res.ok) throw new Error("Upload failed");

				const { url } = await res.json();
				urls.push(url);
			}

			setUploadedPhotos([...uploadedPhotos, ...urls]);
		} catch (err) {
			console.error("Upload error:", err);
			alert("Failed to upload photos");
		} finally {
			setUploading(false);
		}
	}

	async function saveVisit() {
		if (!selectedAirport || !date) {
			alert("Please select an airport and date");
			return;
		}

		setSaving(true);
		try {
			const filteredFlightNumbers = flightNumbers.filter(
				(fn) => fn.trim() !== "",
			);
			const visitData = {
				id: editingVisit?.id,
				airportIdent: selectedAirport.ident,
				date,
				flightNumbers:
					filteredFlightNumbers.length > 0 ? filteredFlightNumbers : undefined,
				isLayover: isLayover || undefined,
				notes: notes || undefined,
				photos: uploadedPhotos.length > 0 ? uploadedPhotos : undefined,
			};

			const res = await fetch("/api/visits", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(visitData),
			});

			if (!res.ok) throw new Error("Save failed");

			alert(
				editingVisit
					? "Visit updated successfully!"
					: "Visit saved successfully!",
			);
			resetForm();
			await loadVisits();
		} catch (err) {
			console.error("Save error:", err);
			alert("Failed to save visit");
		} finally {
			setSaving(false);
		}
	}

	async function deleteVisit(visitId: string) {
		if (!confirm("Are you sure you want to delete this visit?")) return;

		try {
			const res = await fetch(`/api/visits?id=${visitId}`, {
				method: "DELETE",
			});

			if (!res.ok) throw new Error("Delete failed");

			alert("Visit deleted successfully!");
			await loadVisits();
			if (editingVisit?.id === visitId) {
				resetForm();
			}
		} catch (err) {
			console.error("Delete error:", err);
			alert("Failed to delete visit");
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

	return (
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
				{/* Form */}
				<div className="space-y-4">
					<h2 className="text-xl font-medium">
						{editingVisit ? "Edit Visit" : "Add New Visit"}
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

					<div>
						<label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
							Visit Date
						</label>
						<input
							type="date"
							value={date}
							onChange={(e) => setDate(e.target.value)}
							className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
						/>
					</div>

					<div>
						<div className="mb-3 flex items-center gap-3">
							<label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
								Flight Information (optional)
							</label>
							<label className="flex items-center gap-2">
								<input
									type="checkbox"
									checked={isLayover}
									onChange={(e) => {
										setIsLayover(e.target.checked);
										if (e.target.checked && flightNumbers.length === 1) {
											setFlightNumbers(["", ""]);
										} else if (!e.target.checked && flightNumbers.length > 1) {
											setFlightNumbers([flightNumbers[0] || ""]);
										}
									}}
									className="rounded border-zinc-300 text-zinc-900 focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700"
								/>
								<span className="text-sm text-zinc-600 dark:text-zinc-400">
									Layover
								</span>
							</label>
						</div>

						{isLayover ? (
							<div className="space-y-2">
								<div>
									<label className="mb-1 block text-xs text-zinc-500 dark:text-zinc-400">
										Arrival Flight
									</label>
									<input
										type="text"
										value={flightNumbers[0] || ""}
										onChange={(e) => {
											const newFlights = [...flightNumbers];
											newFlights[0] = e.target.value;
											setFlightNumbers(newFlights);
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
										value={flightNumbers[1] || ""}
										onChange={(e) => {
											const newFlights = [...flightNumbers];
											newFlights[1] = e.target.value;
											setFlightNumbers(newFlights);
										}}
										placeholder="e.g., THY 35"
										className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
									/>
								</div>
							</div>
						) : (
							<input
								type="text"
								value={flightNumbers[0] || ""}
								onChange={(e) => setFlightNumbers([e.target.value])}
								placeholder="e.g., THY 36"
								className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
							/>
						)}
					</div>

					<div>
						<label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
							Notes (optional)
						</label>
						<textarea
							value={notes}
							onChange={(e) => setNotes(e.target.value)}
							rows={3}
							placeholder="Add any notes about this visit..."
							className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
						/>
					</div>

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
						{uploadedPhotos.length > 0 && (
							<div className="mt-2 grid grid-cols-3 gap-2">
								{uploadedPhotos.map((photo, idx) => (
									<div key={idx} className="relative">
										<img
											src={photo}
											alt={`Upload ${idx + 1}`}
											className="h-24 w-full rounded object-cover"
										/>
										<button
											type="button"
											onClick={() =>
												setUploadedPhotos(
													uploadedPhotos.filter((_, i) => i !== idx),
												)
											}
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
							onClick={saveVisit}
							disabled={saving || !selectedAirport || !date}
							className="rounded-lg bg-zinc-900 px-6 py-2 text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
						>
							{saving
								? "Saving..."
								: editingVisit
									? "Update Visit"
									: "Save Visit"}
						</button>
						{editingVisit && (
							<button
								type="button"
								onClick={resetForm}
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
				{/* Visits List */}
				<div className="space-y-4">
					<h2 className="text-xl font-medium">
						Existing Visits ({visits.length})
					</h2>

					<div className="space-y-2">
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
													onClick={() => editVisit(visit)}
													className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
												>
													Edit
												</button>
												<button
													type="button"
													onClick={() => deleteVisit(visit.id)}
													className="text-sm text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
												>
													Delete
												</button>
											</div>
										</div>
									</div>
								);
							})}

						{visits.length === 0 && (
							<p className="text-center text-zinc-600 dark:text-zinc-400">
								No visits yet. Add your first airport visit!
							</p>
						)}
					</div>
				</div>
			</motion.section>
		</motion.main>
	);
}
