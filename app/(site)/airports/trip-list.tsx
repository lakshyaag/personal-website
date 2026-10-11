"use client";

import type { Airport, PublicFlight } from "@/lib/public-types";
import { Plane } from "lucide-react";
import { motion } from "motion/react";
import { useMemo } from "react";
import { FlightPhotos, airportCode, formatDate } from "./parts";

/** Newest trip first; each trip's legs in the order flown. */
function trips(flights: PublicFlight[]) {
	const result: PublicFlight[][] = [];
	// Flights arrive newest first, so a connecting flight's previous leg comes right after it.
	for (const flight of flights) {
		const current = result.at(-1);
		if (current?.at(-1)?.connecting) current.push(flight);
		else result.push([flight]);
	}
	return result.map((legs) => legs.reverse());
}

export default function TripList({
	flights,
	airportsByIdent,
}: {
	flights: PublicFlight[];
	airportsByIdent: Record<string, Airport>;
}) {
	const grouped = useMemo(() => trips(flights), [flights]);
	const code = (ident: string) => airportCode(airportsByIdent[ident], ident);
	const city = (ident: string) =>
		airportsByIdent[ident]?.municipality || code(ident);

	return (
		<div className="space-y-4">
			{grouped.map((legs) => {
				const first = legs[0];
				const last = legs[legs.length - 1];
				const stops = [first.from, ...legs.map((leg) => leg.to)];
				const photos = legs.flatMap((leg) => leg.photos);
				const km = legs.reduce((sum, leg) => sum + leg.km, 0);
				return (
					<motion.article
						key={first.id}
						className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900/50"
						initial={{ opacity: 0, y: 10 }}
						animate={{ opacity: 1, y: 0 }}
					>
						<div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
							<h3 className="font-mono text-lg font-medium text-zinc-900 dark:text-zinc-100">
								{stops.map(code).join(" → ")}
							</h3>
							<span className="text-sm text-zinc-500 dark:text-zinc-400">
								{formatDate(first.date)}
								{last.date !== first.date && ` – ${formatDate(last.date)}`}
							</span>
						</div>
						<p className="-mt-3 text-sm text-zinc-600 dark:text-zinc-400">
							{stops.map(city).join(" → ")}
							{legs.length > 1 &&
								` · via ${stops.slice(1, -1).map(code).join(", ")}`}{" "}
							· {km.toLocaleString("en-US")} km
						</p>
						<ul className="space-y-2">
							{legs.map((leg) => (
								<li
									key={leg.id}
									className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm"
								>
									<Plane className="h-3.5 w-3.5 text-zinc-500" />
									<span className="font-medium text-zinc-800 dark:text-zinc-200">
										{leg.code}
									</span>
									<span className="text-zinc-600 dark:text-zinc-400">
										{[
											legs.length > 1 && `${code(leg.from)} → ${code(leg.to)}`,
											leg.airlineName,
											leg.aircraft,
											leg.registration,
											leg.cabin &&
												leg.cabin !== "economy" &&
												leg.cabin[0].toUpperCase() + leg.cabin.slice(1),
										]
											.filter(Boolean)
											.join(" · ")}
									</span>
								</li>
							))}
						</ul>
						<FlightPhotos
							photos={photos}
							caption={`${stops.map(code).join(" → ")} · ${formatDate(first.date)}`}
						/>
					</motion.article>
				);
			})}
		</div>
	);
}
