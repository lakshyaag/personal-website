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

export interface Visit {
	id: string;
	airportIdent: string;
	date: string; // YYYY-MM-DD
	flightNumber?: string; // e.g., "THY 36", "SEJ 904"
	notes?: string;
	photos?: string[];
}
