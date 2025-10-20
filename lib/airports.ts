export interface Airport {
    ident: string;
    iata_code: string;
    name: string;
    lat: number;
    lon: number;
    iso_country: string;
    municipality: string;
}

export interface Visit {
    id: string;
    airportIdent: string;
    date: string; // YYYY-MM-DD
    notes?: string;
    photos?: string[];
}