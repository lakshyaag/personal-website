"use client";

import type { Airport, PublicFlight } from "@/lib/public-types";
import type { LatLngTuple } from "leaflet";
import { useTheme } from "next-themes";
import { useMemo } from "react";
import {
	CircleMarker,
	MapContainer,
	Polyline,
	TileLayer,
	Tooltip,
} from "react-leaflet";

/**
 * Points along the great circle between two airports, so long-haul routes curve the way they're
 * flown. Longitudes are unwrapped so a route across the antimeridian doesn't jump.
 */
function greatCircle(a: Airport, b: Airport, steps = 48): LatLngTuple[] {
	const rad = Math.PI / 180;
	const [lat1, lon1, lat2, lon2] = [a.lat, a.lon, b.lat, b.lon].map(
		(v) => v * rad,
	);
	const d =
		2 *
		Math.asin(
			Math.sqrt(
				Math.sin((lat2 - lat1) / 2) ** 2 +
					Math.cos(lat1) * Math.cos(lat2) * Math.sin((lon2 - lon1) / 2) ** 2,
			),
		);
	if (d === 0) return [[a.lat, a.lon]];
	const points: LatLngTuple[] = [];
	for (let i = 0; i <= steps; i++) {
		const f = i / steps;
		const A = Math.sin((1 - f) * d) / Math.sin(d);
		const B = Math.sin(f * d) / Math.sin(d);
		const x =
			A * Math.cos(lat1) * Math.cos(lon1) + B * Math.cos(lat2) * Math.cos(lon2);
		const y =
			A * Math.cos(lat1) * Math.sin(lon1) + B * Math.cos(lat2) * Math.sin(lon2);
		const z = A * Math.sin(lat1) + B * Math.sin(lat2);
		let lon = Math.atan2(y, x) / rad;
		const previous = points.at(-1)?.[1];
		if (previous !== undefined)
			while (Math.abs(lon - previous) > 180) lon += lon < previous ? 360 : -360;
		points.push([Math.atan2(z, Math.sqrt(x * x + y * y)) / rad, lon]);
	}
	return points;
}

export default function AirportMap({
	flights,
	airportsByIdent,
}: {
	flights: PublicFlight[];
	airportsByIdent: Record<string, Airport>;
}) {
	const { resolvedTheme } = useTheme();
	const isDark = resolvedTheme === "dark";
	const color = isDark ? "#fafafa" : "#18181b";

	// CARTO tiles need a key; it's public by design and restricted to this site's domains.
	const tileUrl = useMemo(() => {
		const style = isDark ? "dark_all" : "light_all";
		return `https://basemaps.cartocdn.com/rastertiles/${style}/{z}/{x}/{y}{r}.png?key=${process.env.NEXT_PUBLIC_CARTO_KEY}`;
	}, [isDark]);

	const { routes, stops } = useMemo(() => {
		const routes = new Map<string, { points: LatLngTuple[]; count: number }>();
		const stops = new Map<string, number>();
		for (const flight of flights) {
			const from = airportsByIdent[flight.from];
			const to = airportsByIdent[flight.to];
			if (!from || !to) continue;
			// One line per airport pair, whichever way it was flown.
			const key = [flight.from, flight.to].sort().join("-");
			const route = routes.get(key);
			if (route) route.count++;
			else routes.set(key, { points: greatCircle(from, to), count: 1 });
			for (const ident of [flight.from, flight.to])
				stops.set(ident, (stops.get(ident) ?? 0) + 1);
		}
		return { routes: [...routes.entries()], stops: [...stops.entries()] };
	}, [flights, airportsByIdent]);

	return (
		<MapContainer
			center={[30, 0]}
			zoom={2}
			scrollWheelZoom
			worldCopyJump
			className="h-[480px] w-full rounded-xl border border-zinc-200 dark:border-zinc-800"
		>
			<TileLayer
				attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
				url={tileUrl}
				maxZoom={19}
			/>
			{routes.map(([key, route]) => (
				<Polyline
					key={key}
					positions={route.points}
					pathOptions={{
						color,
						weight: Math.min(1 + route.count * 0.5, 4),
						opacity: 0.45,
					}}
				/>
			))}
			{stops.map(([ident, count]) => {
				const airport = airportsByIdent[ident];
				return (
					<CircleMarker
						key={ident}
						center={[airport.lat, airport.lon]}
						radius={Math.min(4 + Math.sqrt(count), 9)}
						pathOptions={{
							fillColor: color,
							fillOpacity: 0.85,
							color,
							weight: 1,
						}}
					>
						<Tooltip>
							{airport.name}
							{airport.iata_code && ` (${airport.iata_code})`} · {count}{" "}
							{count === 1 ? "flight" : "flights"}
						</Tooltip>
					</CircleMarker>
				);
			})}
		</MapContainer>
	);
}
