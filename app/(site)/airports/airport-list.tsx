"use client";

import type { Airport, PublicFlight } from "@/lib/public-types";
import { ChevronDown, MapPin } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { FlightPhotos, airportCode, continentNames, formatDate } from "./parts";

const PREVIEW = 3;

export default function AirportList({
	flights,
	airportsByIdent,
}: {
	flights: PublicFlight[];
	airportsByIdent: Record<string, Airport>;
}) {
	const [expanded, setExpanded] = useState<Set<string>>(new Set());
	const code = (ident: string) => airportCode(airportsByIdent[ident], ident);

	// Most recently used airport first. Flights arrive newest first.
	const airports = useMemo(() => {
		const byAirport = new Map<string, PublicFlight[]>();
		for (const flight of flights)
			for (const ident of [flight.from, flight.to])
				byAirport.set(ident, [...(byAirport.get(ident) ?? []), flight]);
		return [...byAirport.entries()]
			.filter(([ident]) => airportsByIdent[ident])
			.map(([ident, list]) => ({
				airport: airportsByIdent[ident],
				flights: list,
				photos: list.flatMap((f) =>
					f.photos.filter((p) => p.airport === ident),
				),
			}));
	}, [flights, airportsByIdent]);

	const toggle = (ident: string) => {
		const next = new Set(expanded);
		if (next.has(ident)) next.delete(ident);
		else next.add(ident);
		setExpanded(next);
	};

	return (
		<div className="space-y-4">
			{airports.map(({ airport, flights: list, photos }) => {
				const open = expanded.has(airport.ident);
				const shown = open ? list : list.slice(0, PREVIEW);
				return (
					<motion.article
						key={airport.ident}
						className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/50"
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
					>
						<div className="flex items-start justify-between gap-4">
							<div>
								<h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
									{airport.name}
									<span className="ml-2 font-mono text-base text-zinc-500 dark:text-zinc-400">
										{code(airport.ident)}
									</span>
								</h3>
								<div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-600 dark:text-zinc-400">
									<span className="flex items-center gap-1">
										<MapPin className="h-4 w-4" />
										{airport.municipality}, {airport.iso_country}
									</span>
									<span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300">
										{continentNames[airport.continent] ?? airport.continent}
									</span>
								</div>
							</div>
							<span className="shrink-0 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
								{list.length} {list.length === 1 ? "flight" : "flights"}
							</span>
						</div>
						<ul className="space-y-1 text-sm text-zinc-600 dark:text-zinc-400">
							<AnimatePresence initial={false}>
								{shown.map((flight) => (
									<motion.li
										key={flight.id}
										initial={{ opacity: 0, height: 0 }}
										animate={{ opacity: 1, height: "auto" }}
										exit={{ opacity: 0, height: 0 }}
									>
										{formatDate(flight.date)} ·{" "}
										<span className="font-medium text-zinc-800 dark:text-zinc-200">
											{flight.code}
										</span>{" "}
										{flight.from === airport.ident
											? `to ${code(flight.to)}`
											: `from ${code(flight.from)}`}
									</motion.li>
								))}
							</AnimatePresence>
						</ul>
						{list.length > PREVIEW && (
							<button
								type="button"
								onClick={() => toggle(airport.ident)}
								aria-expanded={open}
								className="flex items-center gap-1 text-sm text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
							>
								{open ? "Show less" : `Show all ${list.length}`}
								<ChevronDown
									className={`h-4 w-4 transition-transform ${open ? "rotate-180" : ""}`}
								/>
							</button>
						)}
						<FlightPhotos photos={photos} caption={airport.name} />
					</motion.article>
				);
			})}
		</div>
	);
}
