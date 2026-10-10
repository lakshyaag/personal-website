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
export interface PublicVisit {
	id: string;
	airportIdent: string;
	date: string;
	flightNumbers?: string[];
	isLayover?: boolean;
	notes?: string;
	photos?: PublicPhoto[];
}
