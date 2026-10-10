"use client";

import "leaflet/dist/leaflet.css";
import { useTheme } from "next-themes";
import { CircleMarker, MapContainer, TileLayer } from "react-leaflet";

/** Where a photo was taken, on the same CARTO tiles as the public airports map. */
export default function PhotoMap({ lat, lon }: { lat: number; lon: number }) {
	const { resolvedTheme } = useTheme();
	return (
		<MapContainer
			center={[lat, lon]}
			zoom={13}
			scrollWheelZoom={false}
			className="h-44 w-full rounded-xl"
		>
			<TileLayer
				url={`https://basemaps.cartocdn.com/rastertiles/${resolvedTheme === "dark" ? "dark_all" : "light_all"}/{z}/{x}/{y}{r}.png?key=${process.env.NEXT_PUBLIC_CARTO_KEY}`}
				attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
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
