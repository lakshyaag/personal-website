"use client";

import { useMemo } from "react";
import { MapContainer, TileLayer, CircleMarker } from "react-leaflet";
import { useTheme } from "next-themes";
import airports from "@/data/airports.min.json";
import type { Visit, Airport } from "@/lib/airports";
import type { LatLngExpression } from "leaflet";

interface MapProps {
	visits: Visit[];
}

export default function Map({ visits }: MapProps) {
	const { resolvedTheme } = useTheme();

	const tileUrl = useMemo(() => {
		const isDark = resolvedTheme === "dark";
		return isDark
			? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
			: "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png";
	}, [resolvedTheme]);

	const airportsByIdent = useMemo(
		() =>
			Object.fromEntries((airports as Airport[]).map((a) => [a.ident, a])),
		[],
	);

	const markers = useMemo(() => {
		return visits
			.map((visit) => {
				const airport = airportsByIdent[visit.airportIdent];
				if (!airport) return null;

				return {
					position: [airport.lat, airport.lon] as LatLngExpression,
					airport,
					visit,
				};
			})
			.filter((m) => m !== null);
	}, [visits, airportsByIdent]);

	const isDark = resolvedTheme === "dark";

	return (
		<MapContainer
			center={[20, 0]}
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
			{markers.map(
				(marker, idx) =>
					marker && (
						<CircleMarker
							key={idx}
							center={marker.position}
							radius={6}
							pathOptions={{
								fillColor: isDark ? "#fafafa" : "#18181b",
								fillOpacity: 0.8,
								color: isDark ? "#fafafa" : "#18181b",
								weight: 2,
							}}
						/>
					),
			)}
		</MapContainer>
	);
}
