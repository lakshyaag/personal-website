"use client";

import type { PublicFlights } from "@/lib/public-types";
import {
	TRANSITION_SECTION,
	VARIANTS_CONTAINER,
	VARIANTS_SECTION,
} from "@/lib/utils";
import { ChevronDown } from "lucide-react";
import { motion } from "motion/react";
import dynamic from "next/dynamic";
import { useMemo, useState } from "react";
import AirportList from "./airport-list";
import { continentNames } from "./parts";
import TripList from "./trip-list";

const MapContainerComponent = dynamic(() => import("./map"), {
	ssr: false,
	loading: () => (
		<div className="flex h-[480px] w-full items-center justify-center rounded-xl border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
			<p className="text-zinc-600 dark:text-zinc-400">Loading map...</p>
		</div>
	),
});

function FilterChips<T extends string | number>({
	label,
	options,
	selected,
	onChange,
	name = String,
}: {
	label: string;
	options: T[];
	selected: Set<T>;
	onChange: (selected: Set<T>) => void;
	name?: (value: T) => string;
}) {
	if (!options.length) return null;
	const toggle = (value: T) => {
		const next = new Set(selected);
		if (next.has(value)) next.delete(value);
		else next.add(value);
		onChange(next);
	};
	return (
		<div>
			<span className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
				{label}
			</span>
			<div className="flex flex-wrap gap-2">
				{options.map((value) => (
					<button
						key={value}
						type="button"
						onClick={() => toggle(value)}
						className={`rounded-lg px-3 py-1 text-sm transition-colors ${
							selected.has(value)
								? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
								: "bg-zinc-200 text-zinc-700 hover:bg-zinc-300 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
						}`}
					>
						{name(value)}
					</button>
				))}
				{selected.size > 0 && (
					<button
						type="button"
						onClick={() => onChange(new Set())}
						className="rounded-lg px-3 py-1 text-sm text-zinc-600 underline hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
					>
						Clear
					</button>
				)}
			</div>
		</div>
	);
}

export default function Airports({ flights, airports }: PublicFlights) {
	const [years, setYears] = useState<Set<number>>(new Set());
	const [continents, setContinents] = useState<Set<string>>(new Set());
	const [filtersExpanded, setFiltersExpanded] = useState(false);
	const [view, setView] = useState<"trips" | "airports">("trips");

	const airportsByIdent = useMemo(
		() => Object.fromEntries(airports.map((a) => [a.ident, a])),
		[airports],
	);
	const availableYears = useMemo(
		() =>
			[...new Set(flights.map((f) => Number(f.date.slice(0, 4))))].sort(
				(a, b) => b - a,
			),
		[flights],
	);
	const availableContinents = useMemo(
		() => [...new Set(airports.map((a) => a.continent))].sort(),
		[airports],
	);

	const filtered = useMemo(
		() =>
			flights.filter(
				(flight) =>
					(years.size === 0 || years.has(Number(flight.date.slice(0, 4)))) &&
					(continents.size === 0 ||
						[flight.from, flight.to].some((ident) =>
							continents.has(airportsByIdent[ident]?.continent),
						)),
			),
		[flights, years, continents, airportsByIdent],
	);

	const stats = useMemo(() => {
		const idents = new Set(filtered.flatMap((f) => [f.from, f.to]));
		return {
			flights: filtered.length,
			airports: idents.size,
			countries: new Set(
				[...idents].map((ident) => airportsByIdent[ident]?.iso_country),
			).size,
			km: filtered.reduce((sum, f) => sum + f.km, 0),
		};
	}, [filtered, airportsByIdent]);

	const activeFilters = years.size + continents.size;

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
				<h1 className="mb-4 text-3xl font-medium">Flights</h1>
				<p className="text-zinc-600 dark:text-zinc-400">
					Every flight I've taken, and the airports along the way.
				</p>
			</motion.section>

			<motion.section
				variants={VARIANTS_SECTION}
				transition={TRANSITION_SECTION}
				className="space-y-4"
			>
				<div className="rounded-lg bg-zinc-100 px-4 py-3 text-sm text-zinc-600 dark:bg-zinc-900/50 dark:text-zinc-400">
					{(
						[
							[stats.flights, "flight", "flights"],
							[stats.airports, "airport", "airports"],
							[stats.countries, "country", "countries"],
							[stats.km, "km", "km"],
						] as const
					).map(([value, one, many], i) => (
						<span key={many}>
							{i > 0 && " • "}
							<strong className="text-zinc-900 dark:text-zinc-100">
								{value.toLocaleString("en-US")}
							</strong>{" "}
							{value === 1 ? one : many}
						</span>
					))}
				</div>

				<div className="rounded-lg border border-zinc-200 dark:border-zinc-800">
					<button
						type="button"
						onClick={() => setFiltersExpanded(!filtersExpanded)}
						className="flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900/50"
					>
						<span className="font-medium">
							Filters {activeFilters > 0 && `(${activeFilters} active)`}
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
							className="flex flex-col gap-4 border-t border-zinc-200 p-4 sm:flex-row sm:justify-between dark:border-zinc-800"
						>
							<FilterChips
								label="Year"
								options={availableYears}
								selected={years}
								onChange={setYears}
							/>
							<FilterChips
								label="Continent"
								options={availableContinents}
								selected={continents}
								onChange={setContinents}
								name={(c) => continentNames[c] ?? c}
							/>
						</motion.div>
					)}
				</div>

				<MapContainerComponent
					flights={filtered}
					airportsByIdent={airportsByIdent}
				/>
			</motion.section>

			{filtered.length > 0 && (
				<motion.section
					variants={VARIANTS_SECTION}
					transition={TRANSITION_SECTION}
				>
					<div className="mb-4 flex w-fit gap-2 rounded-lg border border-zinc-200 p-1 dark:border-zinc-800">
						{(
							[
								["trips", "Trips"],
								["airports", "By Airport"],
							] as const
						).map(([value, name]) => (
							<button
								key={value}
								type="button"
								onClick={() => setView(value)}
								className={`rounded px-3 py-1 text-sm transition-colors ${
									view === value
										? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
										: "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
								}`}
							>
								{name}
							</button>
						))}
					</div>
					{view === "trips" ? (
						<TripList flights={filtered} airportsByIdent={airportsByIdent} />
					) : (
						<AirportList flights={filtered} airportsByIdent={airportsByIdent} />
					)}
				</motion.section>
			)}
		</motion.main>
	);
}
