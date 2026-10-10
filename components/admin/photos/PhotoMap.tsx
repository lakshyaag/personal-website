"use client";

import "leaflet/dist/leaflet.css";
import { useTheme } from "next-themes";
import { CircleMarker, MapContainer, TileLayer } from "react-leaflet";

/**
 * Where a photo was taken, on OpenStreetMap's standard tiles (free with attribution; CARTO's
 * now need an API key). Dark mode inverts the tiles rather than needing a second style.
 */
export default function PhotoMap({ lat, lon }: { lat: number; lon: number }) {
	const { resolvedTheme } = useTheme();
	return (
		<MapContainer
			center={[lat, lon]}
			zoom={13}
			scrollWheelZoom={false}
			className={`h-44 w-full rounded-xl ${resolvedTheme === "dark" ? "[&_.leaflet-tile-pane]:[filter:invert(1)_hue-rotate(180deg)_brightness(0.9)]" : ""}`}
		>
			<TileLayer
				url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
				attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
				maxZoom={19}
			/>
			<CircleMarker
				center={[lat, lon]}
				radius={8}
				pathOptions={{ color: "#2563eb", fillOpacity: 0.8 }}
			/>
		</MapContainer>
	);
}
