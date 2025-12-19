/**
 * Utilities for handling photo references (both HTTP URLs and Supabase Storage refs)
 *
 * Photos can be stored as:
 * - HTTP URLs: "https://..." (legacy Vercel Blob or Supabase public URLs)
 * - Supabase Storage refs: "sb://<bucket>/<path>" (for private photos)
 */

const SUPABASE_REF_PREFIX = "sb://";

export interface SupabaseRef {
	bucket: string;
	path: string;
}

/**
 * Encode a Supabase Storage reference as a string
 * @param bucket - The storage bucket name
 * @param path - The object path within the bucket
 * @returns A string in the format "sb://bucket/path"
 */
export function encodeSupabaseRef(bucket: string, path: string): string {
	return `${SUPABASE_REF_PREFIX}${bucket}/${path}`;
}

/**
 * Parse a Supabase Storage reference string
 * @param str - The reference string to parse
 * @returns The parsed bucket and path, or null if not a valid sb:// ref
 */
export function parseSupabaseRef(str: string): SupabaseRef | null {
	if (!str.startsWith(SUPABASE_REF_PREFIX)) {
		return null;
	}

	const rest = str.slice(SUPABASE_REF_PREFIX.length);
	const slashIndex = rest.indexOf("/");

	if (slashIndex === -1) {
		return null;
	}

	const bucket = rest.slice(0, slashIndex);
	const path = rest.slice(slashIndex + 1);

	if (!bucket || !path) {
		return null;
	}

	return { bucket, path };
}

/**
 * Check if a string is an HTTP(S) URL
 * @param str - The string to check
 * @returns True if the string starts with http:// or https://
 */
export function isHttpUrl(str: string): boolean {
	return str.startsWith("http://") || str.startsWith("https://");
}

/**
 * Check if a string is a Supabase Storage reference
 * @param str - The string to check
 * @returns True if the string starts with sb://
 */
export function isSupabaseRef(str: string): boolean {
	return str.startsWith(SUPABASE_REF_PREFIX);
}

