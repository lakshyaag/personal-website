"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { Visit, Airport } from "@/lib/types";
import { ChevronDown, Plane, Mountain, MapPin } from "lucide-react";

interface AirportListProps {
	visits: Visit[];
	airportsByIdent: Record<string, Airport>;
	viewMode: "grouped" | "timeline";
}

interface GroupedAirport {
	airport: Airport;
	visits: Visit[];
	lastVisitDate: string;
}

function formatElevation(elevation: number): string {
	if (elevation === 0) return "";
	return `${elevation.toLocaleString()} ft`;
}

function formatDate(dateStr: string): string {
	return new Date(dateStr).toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

const continentNames: Record<string, string> = {
	AF: "Africa",
	AS: "Asia",
	EU: "Europe",
	NA: "North America",
	SA: "South America",
	OC: "Oceania",
	AN: "Antarctica",
};

export default function AirportList({
	visits,
	airportsByIdent,
	viewMode,
}: AirportListProps) {
	const [expandedAirports, setExpandedAirports] = useState<Set<string>>(
		new Set(),
	);

	const groupedAirports: GroupedAirport[] = useMemo(() => {
		const groups = new Map<string, Visit[]>();

		for (const visit of visits) {
			const existing = groups.get(visit.airportIdent) || [];
			existing.push(visit);
			groups.set(visit.airportIdent, existing);
		}

		for (const [_, visitList] of groups) {
			visitList.sort((a, b) => b.date.localeCompare(a.date));
		}

		return Array.from(groups.entries())
			.map(([ident, visitList]) => ({
				airport: airportsByIdent[ident],
				visits: visitList,
				lastVisitDate: visitList[0].date,
			}))
			.filter((item) => item.airport)
			.sort((a, b) => b.lastVisitDate.localeCompare(a.lastVisitDate));
	}, [visits, airportsByIdent]);

	const timelineVisits = useMemo(() => {
		return visits
			.map((visit) => ({
				visit,
				airport: airportsByIdent[visit.airportIdent],
			}))
			.filter((item) => item.airport)
			.sort((a, b) => b.visit.date.localeCompare(a.visit.date));
	}, [visits, airportsByIdent]);

	const toggleAirport = (ident: string) => {
		const newExpanded = new Set(expandedAirports);
		if (newExpanded.has(ident)) {
			newExpanded.delete(ident);
		} else {
			newExpanded.add(ident);
		}
		setExpandedAirports(newExpanded);
	};

	if (visits.length === 0) {
		return (
			<div className="rounded-xl border border-zinc-200 bg-zinc-50/40 p-8 text-center dark:border-zinc-800 dark:bg-zinc-900/40">
				<p className="text-zinc-600 dark:text-zinc-400">
					No airport visits recorded yet.
				</p>
			</div>
		);
	}

	if (viewMode === "timeline") {
		return (
			<div className="space-y-4">
				{timelineVisits.map(({ visit, airport }) => (
					<motion.div
						key={visit.id}
						className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900/50"
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
					>
						<div className="flex items-start justify-between gap-6">
							<div className="flex-1 space-y-3">
								{/* Airport name and date */}
								<div>
									<h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
										{airport.name}
										{airport.iata_code && (
											<span className="ml-2 font-mono text-base text-zinc-500 dark:text-zinc-400">
												({airport.iata_code})
											</span>
										)}
									</h3>
									<div className="mt-1 flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
										<span className="font-mono">{airport.ident}</span>
									</div>
								</div>

								{/* Location and metadata */}
								<div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
									<div className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400">
										<MapPin className="h-4 w-4" />
										<span>
											{airport.municipality}, {airport.iso_country}
										</span>
									</div>
									{airport.continent && (
										<span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
											{continentNames[airport.continent]}
										</span>
									)}
									{airport.elevation_ft > 0 && (
										<div className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400">
											<Mountain className="h-4 w-4" />
											<span>{formatElevation(airport.elevation_ft)}</span>
										</div>
									)}
								</div>

								{/* Flight info */}
								{visit.flightNumbers && visit.flightNumbers.length > 0 && (
									<div className="flex items-center gap-2 text-sm">
										<Plane className="h-4 w-4 text-zinc-500" />
										<span className="font-medium text-zinc-700 dark:text-zinc-300">
											{visit.isLayover && visit.flightNumbers.length > 1
												? `${visit.flightNumbers[0]} → ${visit.flightNumbers[1]}`
												: visit.flightNumbers.join(", ")}
										</span>
										{visit.isLayover && (
											<span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
												Layover
											</span>
										)}
									</div>
								)}

								{/* Notes */}
								{visit.notes && (
									<p className="text-sm italic text-zinc-600 dark:text-zinc-400">
										{visit.notes}
									</p>
								)}

								{/* Photos */}
								{visit.photos && visit.photos.length > 0 && (
									<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
										{visit.photos.map((photo, idx) => (
											<img
												key={idx}
												src={photo}
												alt={`${airport.name} photo ${idx + 1}`}
												className="h-32 w-full rounded-lg object-cover"
											/>
										))}
									</div>
								)}
							</div>

							{/* Date badge */}
							<div className="flex-shrink-0">
								<div className="rounded-lg bg-zinc-100 px-3 py-2 text-center dark:bg-zinc-800">
									<div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
										{new Date(visit.date).toLocaleDateString("en-US", {
											month: "short",
										})}
									</div>
									<div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
										{new Date(visit.date).getDate()}
									</div>
									<div className="text-xs text-zinc-500 dark:text-zinc-400">
										{new Date(visit.date).getFullYear()}
									</div>
								</div>
							</div>
						</div>
					</motion.div>
				))}
			</div>
		);
	}

	// Grouped view
	return (
		<div className="space-y-4">
			{groupedAirports.map(({ airport, visits: airportVisits }) => {
				const isExpanded = expandedAirports.has(airport.ident);
				const lastVisit = airportVisits[0];
				const hasMultipleVisits = airportVisits.length > 1;

				return (
					<motion.div
						key={airport.ident}
						className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900/50"
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
					>
						<button
							type="button"
							onClick={() => hasMultipleVisits && toggleAirport(airport.ident)}
							className="w-full p-6 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/80"
						>
							<div className="flex items-start justify-between gap-6">
								<div className="flex-1 space-y-3">
									{/* Airport name and visits badge */}
									<div className="flex items-center gap-3">
										<h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
											{airport.name}
											{airport.iata_code && (
												<span className="ml-2 font-mono text-base text-zinc-500 dark:text-zinc-400">
													({airport.iata_code})
												</span>
											)}
										</h3>
										{hasMultipleVisits && (
											<span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
												{airportVisits.length} visits
											</span>
										)}
									</div>

									<div className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
										<span className="font-mono">{airport.ident}</span>
									</div>

									{/* Location and metadata */}
									<div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
										<div className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400">
											<MapPin className="h-4 w-4" />
											<span>
												{airport.municipality}, {airport.iso_country}
											</span>
										</div>
										{airport.continent && (
											<span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
												{continentNames[airport.continent]}
											</span>
										)}
										{airport.elevation_ft > 0 && (
											<div className="flex items-center gap-1 text-zinc-600 dark:text-zinc-400">
												<Mountain className="h-4 w-4" />
												<span>{formatElevation(airport.elevation_ft)}</span>
											</div>
										)}
									</div>

									{/* Last visit info when not expanded */}
									{!isExpanded && (
										<>
											{lastVisit.flightNumbers && lastVisit.flightNumbers.length > 0 && (
												<div className="flex items-center gap-2 text-sm">
													<Plane className="h-4 w-4 text-zinc-500" />
													<span className="font-medium text-zinc-700 dark:text-zinc-300">
														{lastVisit.isLayover && lastVisit.flightNumbers.length > 1
															? `${lastVisit.flightNumbers[0]} → ${lastVisit.flightNumbers[1]}`
															: lastVisit.flightNumbers.join(", ")}
													</span>
													{lastVisit.isLayover && (
														<span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
															Layover
														</span>
													)}
												</div>
											)}
											{lastVisit.notes && (
												<p className="text-sm italic text-zinc-600 dark:text-zinc-400">
													{lastVisit.notes}
												</p>
											)}
											{lastVisit.photos && lastVisit.photos.length > 0 && (
												<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
													{lastVisit.photos.map((photo, idx) => (
														<img
															key={idx}
															src={photo}
															alt={`${airport.name} photo ${idx + 1}`}
															className="h-32 w-full rounded-lg object-cover"
														/>
													))}
												</div>
											)}
										</>
									)}
								</div>

								{/* Date badge */}
								<div className="flex flex-shrink-0 items-start gap-2">
									<div className="rounded-lg bg-zinc-100 px-3 py-2 text-center dark:bg-zinc-800">
										<div className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
											{new Date(lastVisit.date).toLocaleDateString("en-US", {
												month: "short",
											})}
										</div>
										<div className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
											{new Date(lastVisit.date).getDate()}
										</div>
										<div className="text-xs text-zinc-500 dark:text-zinc-400">
											{new Date(lastVisit.date).getFullYear()}
										</div>
									</div>
									{/* Always reserve space for chevron for consistent alignment */}
									<div className="mt-2 flex items-center justify-center" style={{ width: 20, height: 20 }}>
										{hasMultipleVisits ? (
											<motion.div
												animate={{ rotate: isExpanded ? 180 : 0 }}
												transition={{ duration: 0.2 }}
												className="flex items-center justify-center"
											>
												<ChevronDown className="h-5 w-5 text-zinc-400" />
											</motion.div>
										) : null}
									</div>
								</div>
							</div>
						</button>

						{/* Expanded visits */}
						<AnimatePresence>
							{isExpanded && hasMultipleVisits && (
								<motion.div
									initial={{ opacity: 0, height: 0 }}
									animate={{ opacity: 1, height: "auto" }}
									exit={{ opacity: 0, height: 0 }}
									className="border-t border-zinc-200 dark:border-zinc-800"
								>
									<div className="space-y-px bg-zinc-50 p-4 dark:bg-zinc-900/30">
										{airportVisits.map((visit, idx) => (
											<div
												key={visit.id}
												className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/50"
											>
												<div className="flex items-start justify-between gap-4">
													<div className="flex-1 space-y-2">
														<div className="flex items-center gap-3">
															<span className="font-medium text-zinc-900 dark:text-zinc-100">
																{formatDate(visit.date)}
															</span>
															{visit.flightNumbers && visit.flightNumbers.length > 0 && (
																<div className="flex items-center gap-1.5 text-sm text-zinc-600 dark:text-zinc-400">
																	<Plane className="h-3.5 w-3.5" />
																	<span>
																		{visit.isLayover && visit.flightNumbers.length > 1
																			? `${visit.flightNumbers[0]} → ${visit.flightNumbers[1]}`
																			: visit.flightNumbers.join(", ")}
																	</span>
																	{visit.isLayover && (
																		<span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
																			Layover
																		</span>
																	)}
																</div>
															)}
														</div>
														{visit.notes && (
															<p className="text-sm italic text-zinc-600 dark:text-zinc-400">
																{visit.notes}
															</p>
														)}
														{visit.photos && visit.photos.length > 0 && (
															<div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
																{visit.photos.map((photo, photoIdx) => (
																	<img
																		key={photoIdx}
																		src={photo}
																		alt={`Visit photo ${photoIdx + 1}`}
																		className="h-24 w-full rounded-lg object-cover"
																	/>
																))}
															</div>
														)}
													</div>
												</div>
											</div>
										))}
									</div>
								</motion.div>
							)}
						</AnimatePresence>
					</motion.div>
				);
			})}
		</div>
	);
}
