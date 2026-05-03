const MIGRATED_PREFIXES = ["/blogs/", "/projects/"] as const;

function ensureLeadingSlash(value: string): string {
	return value.startsWith("/") ? value : `/${value}`;
}

function trimTrailingSlash(value: string): string {
	return value.endsWith("/") ? value.slice(0, -1) : value;
}

function isAbsoluteUrl(value: string): boolean {
	return /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//.test(value);
}

export function assetUrl(src?: string | null): string | null | undefined {
	if (!src) return src;
	if (isAbsoluteUrl(src)) return src;

	const normalizedSrc = ensureLeadingSlash(src);
	const base = process.env.NEXT_PUBLIC_ASSET_BASE_URL;

	if (!base) return normalizedSrc;
	if (!MIGRATED_PREFIXES.some((prefix) => normalizedSrc.startsWith(prefix))) {
		return normalizedSrc;
	}

	return `${trimTrailingSlash(base)}${normalizedSrc}`;
}
