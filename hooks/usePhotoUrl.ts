"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase-client";
import { parseSupabaseRef, isHttpUrl, isSupabaseRef } from "@/lib/photo-refs";

// Cache for signed URLs to avoid repeated API calls
// Key: sb:// ref, Value: { url: signedUrl, expiresAt: timestamp }
const signedUrlCache = new Map<string, { url: string; expiresAt: number }>();

// TTL for signed URLs (1 hour in seconds)
const SIGNED_URL_TTL = 3600;

// Buffer before expiration to refresh (5 minutes)
const REFRESH_BUFFER_MS = 5 * 60 * 1000;

/**
 * Get a cached signed URL or null if not cached/expired
 */
function getCachedUrl(ref: string): string | null {
	const cached = signedUrlCache.get(ref);
	if (!cached) return null;

	// Check if URL is still valid (with buffer)
	if (Date.now() + REFRESH_BUFFER_MS >= cached.expiresAt) {
		signedUrlCache.delete(ref);
		return null;
	}

	return cached.url;
}

/**
 * Cache a signed URL
 */
function cacheSignedUrl(ref: string, url: string): void {
	signedUrlCache.set(ref, {
		url,
		expiresAt: Date.now() + SIGNED_URL_TTL * 1000,
	});
}

/**
 * Generate a signed URL for a Supabase Storage reference
 */
async function generateSignedUrl(ref: string): Promise<string | null> {
	const parsed = parseSupabaseRef(ref);
	if (!parsed) return null;

	try {
		const supabase = createClient();
		const { data, error } = await supabase.storage
			.from(parsed.bucket)
			.createSignedUrl(parsed.path, SIGNED_URL_TTL);

		if (error) {
			console.error("Failed to create signed URL:", error);
			return null;
		}

		return data.signedUrl;
	} catch (err) {
		console.error("Error generating signed URL:", err);
		return null;
	}
}

/**
 * Resolve a photo reference to a displayable URL
 * - HTTP URLs are returned as-is
 * - sb:// refs are converted to signed URLs (cached)
 */
export async function resolvePhotoUrl(ref: string): Promise<string> {
	// HTTP URLs pass through directly
	if (isHttpUrl(ref)) {
		return ref;
	}

	// Check if it's a Supabase ref
	if (isSupabaseRef(ref)) {
		// Check cache first
		const cached = getCachedUrl(ref);
		if (cached) return cached;

		// Generate new signed URL
		const signedUrl = await generateSignedUrl(ref);
		if (signedUrl) {
			cacheSignedUrl(ref, signedUrl);
			return signedUrl;
		}
	}

	// Fallback: return the ref as-is (shouldn't happen in normal usage)
	return ref;
}

/**
 * Synchronously get initial URL (for HTTP URLs or cached signed URLs)
 */
function getInitialUrl(ref: string | undefined): string | null {
	if (!ref) return null;
	if (isHttpUrl(ref)) return ref;
	if (isSupabaseRef(ref)) {
		return getCachedUrl(ref);
	}
	return null;
}

/**
 * Hook to resolve a single photo reference to a displayable URL
 */
export function usePhotoUrl(ref: string | undefined): string | null {
	// Initialize with cached/HTTP URL if available
	const [url, setUrl] = useState<string | null>(() => getInitialUrl(ref));

	useEffect(() => {
		if (!ref) {
			setUrl(null);
			return;
		}

		// If it's an HTTP URL, set immediately
		if (isHttpUrl(ref)) {
			setUrl(ref);
			return;
		}

		// Check cache first
		const cached = getCachedUrl(ref);
		if (cached) {
			setUrl(cached);
			return;
		}

		// Need to fetch signed URL
		let cancelled = false;

		resolvePhotoUrl(ref).then((resolvedUrl) => {
			if (!cancelled) {
				setUrl(resolvedUrl);
			}
		});

		return () => {
			cancelled = true;
		};
	}, [ref]);

	return url;
}

/**
 * Hook to resolve multiple photo references to displayable URLs
 */
export function usePhotoUrls(refs: string[]): Map<string, string> {
	// Create a stable key for the refs array to use in dependencies
	const refsKey = useMemo(() => refs.join("|"), [refs]);

	// Initialize with any HTTP URLs or cached signed URLs
	const [urlMap, setUrlMap] = useState<Map<string, string>>(() => {
		const initial = new Map<string, string>();
		for (const ref of refs) {
			const url = getInitialUrl(ref);
			if (url) {
				initial.set(ref, url);
			}
		}
		return initial;
	});

	useEffect(() => {
		// Parse refs from the stable key
		const currentRefs = refsKey ? refsKey.split("|") : [];

		if (currentRefs.length === 0 || (currentRefs.length === 1 && currentRefs[0] === "")) {
			setUrlMap(new Map());
			return;
		}

		let cancelled = false;

		// Resolve all refs
		Promise.all(
			currentRefs.map(async (ref) => {
				const url = await resolvePhotoUrl(ref);
				return [ref, url] as const;
			}),
		).then((results) => {
			if (!cancelled) {
				setUrlMap(new Map(results));
			}
		});

		return () => {
			cancelled = true;
		};
	}, [refsKey]);

	return urlMap;
}
