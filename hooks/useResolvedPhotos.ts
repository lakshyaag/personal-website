"use client";

import { useEffect, useMemo, useState } from "react";
import type { ResolvedPhotoAsset } from "@/lib/photo-assets-db";

const resolveCache = new Map<string, ResolvedPhotoAsset>();
const missingCache = new Set<string>();

/**
 * Batch-resolve stored photo refs to photo_assets metadata (source of truth).
 */
export function useResolvedPhotos(refs: string[]): {
	photos: Map<string, ResolvedPhotoAsset>;
	loading: boolean;
} {
	const refsKey = refs.filter(Boolean).join("\0");
	const stableRefs = useMemo(() => {
		const unique = Array.from(
			new Set(refsKey.length > 0 ? refsKey.split("\0") : []),
		);
		unique.sort();
		return unique;
	}, [refsKey]);

	const [photos, setPhotos] = useState<Map<string, ResolvedPhotoAsset>>(
		() => new Map(),
	);
	const [loading, setLoading] = useState(false);

	useEffect(() => {
		if (stableRefs.length === 0) {
			setPhotos(new Map());
			setLoading(false);
			return;
		}

		const missing = stableRefs.filter(
			(ref) => !resolveCache.has(ref) && !missingCache.has(ref),
		);
		if (missing.length === 0) {
			const next = new Map<string, ResolvedPhotoAsset>();
			for (const ref of stableRefs) {
				const cached = resolveCache.get(ref);
				if (cached) next.set(ref, cached);
			}
			setPhotos(next);
			setLoading(false);
			return;
		}

		let cancelled = false;
		setLoading(true);

		async function load() {
			try {
				const response = await fetch("/api/photos/resolve", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({ refs: missing }),
				});
				if (!response.ok) {
					throw new Error("Failed to resolve photos");
				}
				const data = (await response.json()) as {
					photos: Record<string, ResolvedPhotoAsset>;
				};
				for (const ref of missing) {
					const photo = data.photos[ref];
					if (photo) {
						resolveCache.set(ref, photo);
						missingCache.delete(ref);
					} else {
						missingCache.add(ref);
					}
				}
				if (cancelled) return;
				const next = new Map<string, ResolvedPhotoAsset>();
				for (const ref of stableRefs) {
					const cached = resolveCache.get(ref);
					if (cached) next.set(ref, cached);
				}
				setPhotos(next);
			} catch (error) {
				console.error(error);
				if (!cancelled) {
					const next = new Map<string, ResolvedPhotoAsset>();
					for (const ref of stableRefs) {
						const cached = resolveCache.get(ref);
						if (cached) next.set(ref, cached);
					}
					setPhotos(next);
				}
			} finally {
				if (!cancelled) setLoading(false);
			}
		}

		void load();
		return () => {
			cancelled = true;
		};
	}, [stableRefs]);

	return { photos, loading };
}

