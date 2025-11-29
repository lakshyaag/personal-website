"use client";

import { useState, useMemo, useEffect } from "react";
import { motion } from "motion/react";
import dynamic from "next/dynamic";
import airports from "@/data/airports.min.json";
import type { Visit, Airport } from "@/lib/models";
import {
	VARIANTS_CONTAINER,
	VARIANTS_SECTION,
	TRANSITION_SECTION,
} from "@/lib/utils";
import AirportList from "./airport-list";
import { ChevronDown, ChevronUp } from "lucide-react";

const Map = dynamic(() => import("./map"), {
	ssr: false,
	loading: () => (
		<div className="flex h-[480px] w-full items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
			<p className="text-zinc-600 dark:text-zinc-400">Loading map...</p>
		</div>
	),
});

export default function AirportsPage() {
	const [visits, setVisits] = useState<Visit[]>([]);
	const [mounted, setMounted] = useState(false);
	const [selectedYears, setSelectedYears] = useState<Set<number>>(new Set());
	const [selectedContinents, setSelectedContinents] = useState<Set<string>>(
		new Set(),
	);
	const [filtersExpanded, setFiltersExpanded] = useState(false);
	const [viewMode, setViewMode] = useState<"grouped" | "timeline">("grouped");

	useEffect(() => {
		setMounted(true);
		fetch("/api/visits")
			.then((r) => r.json())
			.then(setVisits)
			.catch((err) => console.error("Failed to fetch visits:", err));
	}, []);

	const airportsByIdent = useMemo(
		() =>
			Object.fromEntries((airports as Airport[]).map((a) => [a.ident, a])),
		[],
	);

	const { availableYears, availableContinents } = useMemo(() => {
		const years = new Set<number>();
		const continents = new Set<string>();

		for (const visit of visits) {
			const year = Number.parseInt(visit.date.substring(0, 4));
			years.add(year);

			const airport = airportsByIdent[visit.airportIdent];
			if (airport?.continent) {
				continents.add(airport.continent);
			}
		}

		return {
			availableYears: Array.from(years).sort((a, b) => b - a),
			availableContinents: Array.from(continents).sort(),
		};
	}, [visits, airportsByIdent]);

	const filteredVisits = useMemo(() => {
		return visits.filter((visit) => {
			const year = Number.parseInt(visit.date.substring(0, 4));
			const yearMatch = selectedYears.size === 0 || selectedYears.has(year);

			const airport = airportsByIdent[visit.airportIdent];
			const continentMatch =
				selectedContinents.size === 0 ||
				(airport?.continent && selectedContinents.has(airport.continent));

			return yearMatch && continentMatch;
		});
	}, [visits, selectedYears, selectedContinents, airportsByIdent]);

	const stats = useMemo(() => {
		const uniqueAirports = new Set(
			filteredVisits.map((v) => v.airportIdent),
		).size;
		const countries = new Set(
			filteredVisits.map((v) => airportsByIdent[v.airportIdent]?.iso_country),
		);

		return {
			totalVisits: filteredVisits.length,
			uniqueAirports,
			totalCountries: countries.size,
		};
	}, [filteredVisits, airportsByIdent]);

	const toggleYear = (year: number) => {
		const newYears = new Set(selectedYears);
		if (newYears.has(year)) {
			newYears.delete(year);
		} else {
			newYears.add(year);
		}
		setSelectedYears(newYears);
	};

	const toggleContinent = (continent: string) => {
		const newContinents = new Set(selectedContinents);
		if (newContinents.has(continent)) {
			newContinents.delete(continent);
		} else {
			newContinents.add(continent);
		}
		setSelectedContinents(newContinents);
	};

	const continentNames: Record<string, string> = {
		AF: "Africa",
		AS: "Asia",
		EU: "Europe",
		NA: "North America",
		SA: "South America",
		OC: "Oceania",
		AN: "Antarctica",
	};

	const hasActiveFilters = selectedYears.size > 0 || selectedContinents.size > 0;

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
				<h1 className="mb-4 text-3xl font-medium">Airport Visits</h1>
				<p className="text-zinc-600 dark:text-zinc-400">
					A collection of airports I've visited around the world.
				</p>
			</motion.section>

			<motion.section
				variants={VARIANTS_SECTION}
				transition={TRANSITION_SECTION}
				className="space-y-4"
			>
				{/* Stats */}
				<div className="rounded-lg bg-zinc-100 px-4 py-3 dark:bg-zinc-900/50">
					<div className="flex flex-wrap items-center gap-4 text-sm">
						<div className="text-zinc-600 dark:text-zinc-400">
							<strong className="text-zinc-900 dark:text-zinc-100">
								{stats.uniqueAirports}
							</strong>{" "}
							airport{stats.uniqueAirports !== 1 ? "s" : ""} •{" "}
							<strong className="text-zinc-900 dark:text-zinc-100">
								{stats.totalVisits}
							</strong>{" "}
							visit{stats.totalVisits !== 1 ? "s" : ""} •{" "}
							<strong className="text-zinc-900 dark:text-zinc-100">
								{stats.totalCountries}
							</strong>{" "}
							countries
						</div>
					</div>
				</div>

				{/* Filters */}
				<div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
					<button
						type="button"
						onClick={() => setFiltersExpanded(!filtersExpanded)}
						className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
					>
						<span className="font-medium">
							Filters {hasActiveFilters && `(${selectedYears.size + selectedContinents.size} active)`}
						</span>
						<motion.div
							animate={{ rotate: filtersExpanded ? 180 : 0 }}
							transition={{ duration: 0.2 }}
						>
							<ChevronDown className="h-4 w-4" />
						</motion.div>
					</button>

					{filtersExpanded && (
						<motion.div
							initial={{ opacity: 0, height: 0 }}
							animate={{ opacity: 1, height: "auto" }}
							exit={{ opacity: 0, height: 0 }}
							className="border-t border-zinc-200 p-4 dark:border-zinc-800"
						>
							<div className="space-y-4 flex flex-row gap-2 justify-between">
								{/* Year filter */}
								{availableYears.length > 0 && (
									<div>
										<label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
											Year
										</label>
										<div className="flex flex-wrap gap-2">
											{availableYears.map((year) => (
												<button
													key={year}
													type="button"
													onClick={() => toggleYear(year)}
													className={`rounded-lg px-3 py-1 text-sm transition-colors ${selectedYears.has(year)
															? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
															: "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
														}`}
												>
													{year}
												</button>
											))}
											{selectedYears.size > 0 && (
												<button
													type="button"
													onClick={() => setSelectedYears(new Set())}
													className="rounded-lg px-3 py-1 text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
												>
													Clear
												</button>
											)}
										</div>
									</div>
								)}

								{/* Continent filter */}
								{availableContinents.length > 0 && (
									<div>
										<label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
											Continent
										</label>
										<div className="flex flex-wrap gap-2">
											{availableContinents.map((continent) => (
												<button
													key={continent}
													type="button"
													onClick={() => toggleContinent(continent)}
													className={`rounded-lg px-3 py-1 text-sm transition-colors ${selectedContinents.has(continent)
															? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
															: "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
														}`}
												>
													{continentNames[continent] || continent}
												</button>
											))}
											{selectedContinents.size > 0 && (
												<button
													type="button"
													onClick={() => setSelectedContinents(new Set())}
													className="rounded-lg px-3 py-1 text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
												>
													Clear
												</button>
											)}
										</div>
									</div>
								)}
							</div>
						</motion.div>
					)}
				</div>

				{/* Map */}
				<Map visits={filteredVisits} />
			</motion.section>

			{filteredVisits.length > 0 && (
				<motion.section
					variants={VARIANTS_SECTION}
					transition={TRANSITION_SECTION}
				>
					<div className="mb-4 flex items-center justify-between">
						<div className="flex gap-2 rounded-lg border border-zinc-200 p-1 dark:border-zinc-800">
							<button
								type="button"
								onClick={() => setViewMode("grouped")}
								className={`rounded px-3 py-1 text-sm transition-colors ${viewMode === "grouped"
										? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
										: "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
									}`}
							>
								By Airport
							</button>
							<button
								type="button"
								onClick={() => setViewMode("timeline")}
								className={`rounded px-3 py-1 text-sm transition-colors ${viewMode === "timeline"
										? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
										: "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
									}`}
							>
								Timeline
							</button>
						</div>
					</div>
					<AirportList
						visits={filteredVisits}
						airportsByIdent={airportsByIdent}
						viewMode={viewMode}
					/>
				</motion.section>
			)}
		</motion.main>
	);
}
