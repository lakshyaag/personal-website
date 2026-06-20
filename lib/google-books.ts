const GOOGLE_BOOKS_BASE = "https://www.googleapis.com/books/v1";
const CACHE_TTL_MS = 5 * 60 * 1000;

export interface GoogleBooksVolumeInfo {
	title: string;
	authors?: string[];
	description?: string;
	categories?: string[];
	imageLinks?: {
		thumbnail?: string;
	};
	industryIdentifiers?: Array<{
		type: string;
		identifier: string;
	}>;
}

export interface GoogleBooksResult {
	id: string;
	volumeInfo: GoogleBooksVolumeInfo;
}

export interface GoogleBooksSearchResponse {
	items?: GoogleBooksResult[];
}

export class GoogleBooksError extends Error {
	status: number;

	constructor(message: string, status: number) {
		super(message);
		this.name = "GoogleBooksError";
		this.status = status;
	}
}

const cache = new Map<string, { expires: number; data: unknown }>();

function getApiKey(): string {
	const key = process.env.GOOGLE_API_KEY;
	if (!key) {
		throw new GoogleBooksError("Google Books API key is not configured", 500);
	}
	return key;
}

function getCached<T>(key: string): T | null {
	const entry = cache.get(key);
	if (!entry) return null;

	if (entry.expires > Date.now()) {
		return entry.data as T;
	}

	cache.delete(key);
	return null;
}

function setCache(key: string, data: unknown) {
	cache.set(key, { expires: Date.now() + CACHE_TTL_MS, data });
}

async function fetchGoogleBooks<T>(
	path: string,
	params: Record<string, string>,
): Promise<T> {
	const cacheKey = `${path}?${new URLSearchParams(params).toString()}`;
	const cached = getCached<T>(cacheKey);
	if (cached) return cached;

	const url = new URL(`${GOOGLE_BOOKS_BASE}${path}`);
	for (const [key, value] of Object.entries(params)) {
		url.searchParams.set(key, value);
	}
	url.searchParams.set("key", getApiKey());

	const res = await fetch(url);

	if (res.status === 429) {
		throw new GoogleBooksError(
			"Book search is temporarily unavailable. Please try again later.",
			429,
		);
	}

	if (!res.ok) {
		console.error("Google Books API error:", res.status, await res.text());
		throw new GoogleBooksError("Failed to fetch from Google Books", res.status);
	}

	const data = (await res.json()) as T;
	setCache(cacheKey, data);
	return data;
}

export async function searchGoogleBooks(
	query: string,
	maxResults = 10,
): Promise<GoogleBooksSearchResponse> {
	return fetchGoogleBooks<GoogleBooksSearchResponse>("/volumes", {
		q: query,
		maxResults: String(maxResults),
	});
}

export async function getGoogleBooksVolume(
	volumeId: string,
): Promise<GoogleBooksResult> {
	return fetchGoogleBooks<GoogleBooksResult>(
		`/volumes/${encodeURIComponent(volumeId)}`,
		{},
	);
}
