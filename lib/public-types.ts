/** Shapes the public pages render. Built on the server from the Worker's data (lib/backend/public-data.ts). */
export interface Airport {
	ident: string;
	iata_code: string;
	name: string;
	lat: number;
	lon: number;
	continent: string;
	iso_country: string;
	iso_region: string;
	municipality: string;
	elevation_ft: number;
}
export interface PublicPhoto {
	id: string;
	displayRef: string;
	thumbnailRef: string | null;
	createdAt: string;
	takenAt: string | null;
	width: number | null;
	height: number | null;
	title: string | null;
	caption: string | null;
	locationLabel: string | null;
}
/** A flight as the public airports page shows it. Seat, times and notes stay private. */
export interface PublicFlight {
	id: string;
	date: string;
	/** "AC 590" */
	code: string;
	airlineName: string;
	from: string;
	to: string;
	km: number;
	aircraft?: string;
	registration?: string;
	cabin?: string;
	/** Continues the previous flight after a layover at `from`. */
	connecting: boolean;
	/** Public photos, each placed at the airport it was taken nearest. */
	photos: (PublicPhoto & { airport: string })[];
}
export interface PublicFlights {
	flights: PublicFlight[];
	/** Only the airports these flights use, so the page never ships the full airport list. */
	airports: Airport[];
}
