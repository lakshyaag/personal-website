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

export interface BookEntry {
    id: string;
    title: string;
    author: string;
    isbn?: string;
    coverUrl?: string;
    description?: string;
    categories?: string[];
    progress?: number; // 0-100, only for reading status
    status: "reading" | "completed" | "want-to-read";
    dateStarted: string;
    dateCompleted?: string;
    notes?: string;
    isCurrent?: boolean;
}

// Database row type (snake_case columns)
export interface BookDbRow {
    id: string;
    title: string;
    author: string;
    isbn: string | null;
    cover_url: string | null;
    description: string | null;
    categories: string[] | null;
    progress: number | null;
    status: "reading" | "completed" | "want-to-read";
    date_started: string;
    date_completed: string | null;
    notes: string | null;
    is_current: boolean;
    created_at: string;
    updated_at: string;
}

// Transform database row to application type
export function transformBookFromDb(row: BookDbRow): BookEntry {
    return {
        id: row.id,
        title: row.title,
        author: row.author,
        isbn: row.isbn ?? undefined,
        coverUrl: row.cover_url ?? undefined,
        description: row.description ?? undefined,
        categories: row.categories ?? undefined,
        progress: row.progress ?? undefined,
        status: row.status,
        dateStarted: row.date_started,
        dateCompleted: row.date_completed ?? undefined,
        notes: row.notes ?? undefined,
        isCurrent: row.is_current,
    };
}

// Transform application type to database row
export function transformBookToDb(
    entry: BookEntry
): Omit<BookDbRow, "created_at" | "updated_at"> {
    return {
        id: entry.id,
        title: entry.title,
        author: entry.author,
        isbn: entry.isbn ?? null,
        cover_url: entry.coverUrl ?? null,
        description: entry.description ?? null,
        categories: entry.categories ?? null,
        progress: entry.progress ?? null,
        status: entry.status,
        date_started: entry.dateStarted,
        date_completed: entry.dateCompleted ?? null,
        notes: entry.notes ?? null,
        is_current: entry.isCurrent ?? false,
    };
}

export interface WorkoutLog {
    id: string;
    content?: string;
    weight?: number;
    photos?: string[];
    date: string; // YYYY-MM-DD
}

// Database row type for workout_logs (snake_case columns)
export interface WorkoutLogDbRow {
    id: string;
    content: string | null;
    weight: number | null;
    photos: string[] | null;
    log_date: string;
    created_at: string;
    updated_at: string;
}

// Transform database row to application type
export function transformWorkoutLogFromDb(row: WorkoutLogDbRow): WorkoutLog {
    return {
        id: row.id,
        content: row.content ?? undefined,
        weight: row.weight ?? undefined,
        photos: row.photos ?? undefined,
        date: row.log_date,
    };
}

// Transform application type to database row
export function transformWorkoutLogToDb(
    log: WorkoutLog
): Omit<WorkoutLogDbRow, "created_at" | "updated_at"> {
    return {
        id: log.id,
        content: log.content ?? null,
        weight: log.weight ?? null,
        photos: log.photos ?? null,
        log_date: log.date,
    };
}
