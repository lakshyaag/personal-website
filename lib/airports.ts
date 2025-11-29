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
	flightNumbers?: string[]; // e.g., ["THY 36"] or ["THY 717", "THY 35"] for layovers
	isLayover?: boolean;
	notes?: string;
	photos?: string[];
}

// Database row type for visits (snake_case columns)
export interface VisitDbRow {
	id: string;
	airport_ident: string;
	visit_date: string;
	flight_numbers: string[] | null;
	is_layover: boolean;
	notes: string | null;
	photos: string[] | null;
	created_at: string;
	updated_at: string;
}

// Transform database row to application type
export function transformVisitFromDb(row: VisitDbRow): Visit {
	return {
		id: row.id,
		airportIdent: row.airport_ident,
		date: row.visit_date,
		flightNumbers: row.flight_numbers ?? undefined,
		isLayover: row.is_layover,
		notes: row.notes ?? undefined,
		photos: row.photos ?? undefined,
	};
}

// Transform application type to database row
export function transformVisitToDb(
	visit: Visit
): Omit<VisitDbRow, "created_at" | "updated_at"> {
	return {
		id: visit.id,
		airport_ident: visit.airportIdent,
		visit_date: visit.date,
		flight_numbers: visit.flightNumbers ?? null,
		is_layover: visit.isLayover ?? false,
		notes: visit.notes ?? null,
		photos: visit.photos ?? null,
	};
}

// Recommendation types
export interface Recommendation {
	id: string;
	bookName: string;
	bookAuthor?: string;
	bookCoverUrl?: string;
	googleBooksId?: string;
	recommenderName?: string;
	comment?: string;
	timestamp: number;
}

// Database row type for recommendations (snake_case columns)
export interface RecommendationDbRow {
	id: string;
	book_name: string;
	book_author: string | null;
	book_cover_url: string | null;
	google_books_id: string | null;
	recommender_name: string | null;
	comment: string | null;
	created_at: string;
}

// Transform database row to application type
export function transformRecommendationFromDb(
	row: RecommendationDbRow
): Recommendation {
	return {
		id: row.id,
		bookName: row.book_name,
		bookAuthor: row.book_author ?? undefined,
		bookCoverUrl: row.book_cover_url ?? undefined,
		googleBooksId: row.google_books_id ?? undefined,
		recommenderName: row.recommender_name ?? undefined,
		comment: row.comment ?? undefined,
		timestamp: new Date(row.created_at).getTime(),
	};
}

// Transform application type to database row
export function transformRecommendationToDb(
	rec: Omit<Recommendation, "id" | "timestamp">
): Omit<RecommendationDbRow, "id" | "created_at"> {
	return {
		book_name: rec.bookName,
		book_author: rec.bookAuthor ?? null,
		book_cover_url: rec.bookCoverUrl ?? null,
		google_books_id: rec.googleBooksId ?? null,
		recommender_name: rec.recommenderName ?? null,
		comment: rec.comment ?? null,
	};
}
