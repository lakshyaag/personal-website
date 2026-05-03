import { supabaseAdmin } from "./supabase-client";
import { encodeSupabaseRef } from "./photo-refs";
import type { PhotoVisibility } from "./photos";

interface PhotoAssetRow {
	id: string;
	visibility: PhotoVisibility;
	gallery_featured: boolean;
	created_at: string;
	taken_at: string | null;
}

interface PhotoDerivativeRow {
	photo_id: string;
	kind: "thumb" | "card" | "full" | "private_full";
	bucket: string;
	path: string;
	width: number | null;
	height: number | null;
}

export interface PhotoAssetListItem {
	id: string;
	visibility: PhotoVisibility;
	galleryFeatured: boolean;
	createdAt: string;
	takenAt: string | null;
	displayRef: string;
	thumbnailRef: string | null;
}

export async function listPhotoAssets(options?: {
	admin?: boolean;
	limit?: number;
}): Promise<PhotoAssetListItem[]> {
	const admin = options?.admin ?? false;
	const limit = options?.limit ?? 120;

	let query = supabaseAdmin
		.from("photo_assets")
		.select("id,visibility,gallery_featured,created_at,taken_at")
		.order("created_at", { ascending: false })
		.limit(limit);

	if (!admin) {
		query = query.eq("visibility", "public").eq("gallery_featured", true);
	}

	const { data: assetRows, error: assetError } = await query;
	if (assetError) {
		throw new Error(`Failed to fetch photo assets: ${assetError.message}`);
	}
	const assets = (assetRows ?? []) as PhotoAssetRow[];
	if (assets.length === 0) return [];

	const ids = assets.map((row) => row.id);
	const { data: derivativeRows, error: derivativeError } = await supabaseAdmin
		.from("photo_derivatives")
		.select("photo_id,kind,bucket,path,width,height")
		.in("photo_id", ids);
	if (derivativeError) {
		throw new Error(`Failed to fetch photo derivatives: ${derivativeError.message}`);
	}

	const derivatives = (derivativeRows ?? []) as PhotoDerivativeRow[];
	const byPhotoId = new Map<string, PhotoDerivativeRow[]>();
	for (const row of derivatives) {
		const list = byPhotoId.get(row.photo_id) ?? [];
		list.push(row);
		byPhotoId.set(row.photo_id, list);
	}

	return assets
		.map((asset) => {
			const photoDerivatives = byPhotoId.get(asset.id) ?? [];
			const fullPublic = photoDerivatives.find((item) => item.kind === "full");
			const fullPrivate = photoDerivatives.find(
				(item) => item.kind === "private_full",
			);
			const thumb = photoDerivatives.find((item) => item.kind === "thumb");
			const display =
				(asset.visibility === "public" ? fullPublic : undefined) ??
				fullPrivate ??
				fullPublic;
			if (!display) return null;
			return {
				id: asset.id,
				visibility: asset.visibility,
				galleryFeatured: asset.gallery_featured,
				createdAt: asset.created_at,
				takenAt: asset.taken_at,
				displayRef: encodeSupabaseRef(display.bucket, display.path),
				thumbnailRef: thumb ? encodeSupabaseRef(thumb.bucket, thumb.path) : null,
			};
		})
		.filter((item): item is PhotoAssetListItem => item !== null);
}

export async function updatePhotoAssetVisibility(params: {
	id: string;
	visibility: PhotoVisibility;
	galleryFeatured: boolean;
}) {
	const { error } = await supabaseAdmin
		.from("photo_assets")
		.update({
			visibility: params.visibility,
			gallery_featured: params.galleryFeatured,
			updated_at: new Date().toISOString(),
		})
		.eq("id", params.id);

	if (error) {
		throw new Error(`Failed to update photo asset: ${error.message}`);
	}
}
