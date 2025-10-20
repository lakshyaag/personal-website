"use client";

import { useState, useMemo, useEffect } from "react";
import { motion } from "motion/react";
import dynamic from "next/dynamic";
import airports from "@/data/airports.min.json";
import type { Visit, Airport } from "@/lib/airports";
import {
	VARIANTS_CONTAINER,
	VARIANTS_SECTION,
	TRANSITION_SECTION,
} from "@/lib/utils";

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

	// Fetch visits on mount
	useEffect(() => {
		fetch("/api/visits")
			.then((r) => r.json())
			.then(setVisits)
			.catch((err) => console.error("Failed to fetch visits:", err));
	}, []);

	const stats = useMemo(() => {
		const countries = new Set(
			visits.map((v) => {
				const airport = (airports as Airport[]).find(
					(a) => a.ident === v.airportIdent,
				);
				return airport?.iso_country;
			}),
		);
		return {
			totalVisits: visits.length,
			totalCountries: countries.size,
		};
	}, [visits]);

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
			>
				<div className="mb-4 rounded-lg bg-zinc-100 px-4 py-3 dark:bg-zinc-900/50">
					<p className="text-sm text-zinc-600 dark:text-zinc-400">
						<strong className="text-zinc-900 dark:text-zinc-100">
							{stats.totalVisits}
						</strong>{" "}
						airport{stats.totalVisits !== 1 ? "s" : ""} visited across{" "}
						<strong className="text-zinc-900 dark:text-zinc-100">
							{stats.totalCountries}
						</strong>{" "}
						countries
					</p>
				</div>

				<Map visits={visits} />
			</motion.section>
		</motion.main>
	);
}
