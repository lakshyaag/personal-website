"use client";

import { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import { useTheme } from "next-themes";
import airports from "@/data/airports.min.json";
import type { Visit, Airport } from "@/lib/airports";
import type { LatLngExpression } from "leaflet";
import L from "leaflet";

// Fix for default marker icons in react-leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
	iconRetinaUrl: "leaflet-markers/marker-icon-2x.png",
	iconUrl: "leaflet-markers/marker-icon.png",
	shadowUrl: "leaflet-markers/marker-shadow.png",
});

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

	return (
		<MapContainer
			center={[20, 0]}
			zoom={1}
			scrollWheelZoom
			className="h-[480px] w-full rounded-xl border border-zinc-200 dark:border-zinc-800"
		>
			<TileLayer
				attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
				url={tileUrl}
				maxZoom={19}
			/>
			{markers.map((marker, idx) => marker && (
				<Marker key={idx} position={marker.position}>
					<Popup>
						<div className="min-w-[200px]">
							<strong>{marker.airport.name}</strong>
							<br />
							<span style={{ color: "#666" }}>
								{marker.airport.ident}
								{marker.airport.iata_code
									? ` (${marker.airport.iata_code})`
									: ""}
							</span>
							<br />
							<span style={{ color: "#666" }}>
								{marker.airport.municipality}, {marker.airport.iso_country}
							</span>
							<br />
							<br />
							<strong>Visited:</strong> {marker.visit.date}
							<br />
							{marker.visit.notes && (
								<>
									<br />
									<em>{marker.visit.notes}</em>
									<br />
								</>
							)}
							{marker.visit.photos && marker.visit.photos.length > 0 && (
								<>
									<br />
									📷 {marker.visit.photos.length} photo
									{marker.visit.photos.length > 1 ? "s" : ""}
									<br />
									<br />
									{marker.visit.photos.map((photo, photoIdx) => (
										<img
											key={photoIdx}
											src={photo}
											alt={`Visit ${photoIdx + 1}`}
											style={{
												width: "100%",
												marginTop: "8px",
												borderRadius: "4px",
											}}
										/>
									))}
								</>
							)}
						</div>
					</Popup>
				</Marker>
			))}
		</MapContainer>
	);
}
