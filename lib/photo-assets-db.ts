import { supabaseAdmin } from "./supabase-client";
import { encodeSupabaseRef, parseSupabaseRef } from "./photo-refs";
import type { PhotoVisibility } from "./photos";

interface PhotoAssetRow {
	id: string;
	visibility: PhotoVisibility;
	gallery_featured: boolean;
	created_at: string;
	taken_at: string | null;
	width: number | null;
	height: number | null;
	safe_exif: Record<string, unknown> | null;
	title: string | null;
	caption: string | null;
	location_label: string | null;
}

interface PhotoDerivativeRow {
	photo_id: string;
	kind: "thumb" | "card" | "full" | "private_full";
	bucket: string;
	path: string;
	width: number | null;
	height: number | null;
}

interface PhotoAttachmentRow {
	photo_id: string;
	context_type: string;
	context_id: string;
	sort_order: number;
	created_at: string;
}

export interface PhotoAssetListItem {
	id: string;
	visibility: PhotoVisibility;
	galleryFeatured: boolean;
	createdAt: string;
	takenAt: string | null;
	width: number | null;
	height: number | null;
	safeExif: Record<string, unknown>;
	title: string | null;
	caption: string | null;
	locationLabel: string | null;
	displayRef: string;
	thumbnailRef: string | null;
	contextType: string | null;
	contextId: string | null;
}

export async function listPhotoAssets(options?: {
	admin?: boolean;
	limit?: number;
}): Promise<PhotoAssetListItem[]> {
	const admin = options?.admin ?? false;
	const limit = options?.limit ?? 120;

	let query = supabaseAdmin
		.from("photo_assets")
		.select(
			"id,visibility,gallery_featured,created_at,taken_at,width,height,safe_exif,title,caption,location_label",
		)
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

	const { data: attachmentRows, error: attachmentError } = await supabaseAdmin
		.from("photo_attachments")
		.select("photo_id,context_type,context_id,sort_order,created_at")
		.in("photo_id", ids);
	if (attachmentError) {
		throw new Error(`Failed to fetch photo attachments: ${attachmentError.message}`);
	}

	const attachments = (attachmentRows ?? []) as PhotoAttachmentRow[];
	const primaryAttachmentByPhotoId = new Map<string, PhotoAttachmentRow>();
	for (const row of attachments) {
		const current = primaryAttachmentByPhotoId.get(row.photo_id);
		if (!current) {
			primaryAttachmentByPhotoId.set(row.photo_id, row);
			continue;
		}
		const shouldReplace =
			row.sort_order < current.sort_order ||
			(row.sort_order === current.sort_order &&
				new Date(row.created_at).getTime() < new Date(current.created_at).getTime());
		if (shouldReplace) {
			primaryAttachmentByPhotoId.set(row.photo_id, row);
		}
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
			const primaryAttachment = primaryAttachmentByPhotoId.get(asset.id);
			return {
				id: asset.id,
				visibility: asset.visibility,
				galleryFeatured: asset.gallery_featured,
				createdAt: asset.created_at,
				takenAt: asset.taken_at,
				width: asset.width,
				height: asset.height,
				safeExif: asset.safe_exif ?? {},
				title: asset.title,
				caption: asset.caption,
				locationLabel: asset.location_label,
				displayRef: encodeSupabaseRef(display.bucket, display.path),
				thumbnailRef: thumb ? encodeSupabaseRef(thumb.bucket, thumb.path) : null,
				contextType: primaryAttachment?.context_type ?? null,
				contextId: primaryAttachment?.context_id ?? null,
			};
		})
		.filter((item): item is PhotoAssetListItem => item !== null);
}

export async function updatePhotoAsset(params: {
	id: string;
	visibility?: PhotoVisibility;
	galleryFeatured?: boolean;
	title?: string | null;
	caption?: string | null;
	locationLabel?: string | null;
}) {
	const updates: Record<string, unknown> = {
		updated_at: new Date().toISOString(),
	};

	if (params.visibility !== undefined) updates.visibility = params.visibility;
	if (params.galleryFeatured !== undefined) {
		updates.gallery_featured = params.galleryFeatured;
	}
	if (params.title !== undefined) updates.title = params.title;
	if (params.caption !== undefined) updates.caption = params.caption;
	if (params.locationLabel !== undefined) {
		updates.location_label = params.locationLabel;
	}

	const { error } = await supabaseAdmin
		.from("photo_assets")
		.update(updates)
		.eq("id", params.id);

	if (error) {
		throw new Error(`Failed to update photo asset: ${error.message}`);
	}
}

interface ContentRowWithPhotos {
	id: string;
	photos: string[] | null;
}

async function removeRefsFromTable(table: string, refsToDelete: Set<string>) {
	const { data, error } = await supabaseAdmin
		.from(table)
		.select("id,photos")
		.not("photos", "is", null);
	if (error) {
		throw new Error(`Failed to read ${table} for photo cleanup: ${error.message}`);
	}

	const rows = (data ?? []) as ContentRowWithPhotos[];
	for (const row of rows) {
		const photos = row.photos ?? [];
		if (photos.length === 0) continue;
		const nextPhotos = photos.filter((photo) => !refsToDelete.has(photo));
		if (nextPhotos.length === photos.length) continue;
		const { error: updateError } = await supabaseAdmin
			.from(table)
			.update({ photos: nextPhotos.length > 0 ? nextPhotos : null })
			.eq("id", row.id);
		if (updateError) {
			throw new Error(
				`Failed to remove deleted photo refs from ${table}: ${updateError.message}`,
			);
		}
	}
}

async function removeStorageObjects(objects: Array<{ bucket: string; path: string }>) {
	const grouped = new Map<string, string[]>();
	for (const obj of objects) {
		if (!obj.bucket || !obj.path) continue;
		const current = grouped.get(obj.bucket) ?? [];
		current.push(obj.path);
		grouped.set(obj.bucket, current);
	}

	for (const [bucket, paths] of grouped) {
		if (paths.length === 0) continue;
		const { error } = await supabaseAdmin.storage.from(bucket).remove(paths);
		if (error) {
			console.warn(`Failed deleting files from ${bucket}: ${error.message}`);
		}
	}
}

export async function deletePhotoAssetById(id: string) {
	const { data: assetRow, error: assetError } = await supabaseAdmin
		.from("photo_assets")
		.select("id,original_private_ref")
		.eq("id", id)
		.single();
	if (assetError || !assetRow) {
		throw new Error(`Failed to load photo asset for deletion: ${assetError?.message}`);
	}

	const { data: derivatives, error: derivativeError } = await supabaseAdmin
		.from("photo_derivatives")
		.select("bucket,path")
		.eq("photo_id", id);
	if (derivativeError) {
		throw new Error(
			`Failed to load photo derivatives for deletion: ${derivativeError.message}`,
		);
	}

	const derivativeRows = (derivatives ?? []) as Array<{
		bucket: string;
		path: string;
	}>;
	const refsToDelete = new Set(
		derivativeRows.map((item) => encodeSupabaseRef(item.bucket, item.path)),
	);

	await removeRefsFromTable("visits", refsToDelete);
	await removeRefsFromTable("journal_entries", refsToDelete);
	await removeRefsFromTable("food_entries", refsToDelete);
	await removeRefsFromTable("workout_logs", refsToDelete);
	await removeRefsFromTable("fits_entries", refsToDelete);

	const { error: deleteError } = await supabaseAdmin
		.from("photo_assets")
		.delete()
		.eq("id", id);
	if (deleteError) {
		throw new Error(`Failed to delete photo asset: ${deleteError.message}`);
	}

	const original = parseSupabaseRef(assetRow.original_private_ref);
	const storageObjects = [
		...derivativeRows.map((item) => ({ bucket: item.bucket, path: item.path })),
		...(original ? [{ bucket: original.bucket, path: original.path }] : []),
	];
	await removeStorageObjects(storageObjects);
}
