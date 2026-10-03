import { createHash } from "node:crypto";
import { z } from "zod";
import {
	MAX_PHOTOS,
	createPhotoSchema,
	dateSchema,
	idSchema,
	timeZoneSchema,
} from "../../shared/journal";

export const sourceEntrySchema = z.object({
	id: idSchema,
	entry_date: dateSchema,
	content: z.string().max(100_000).nullable(),
	photos: z.array(z.string()).nullable(),
	created_at: z.string().transform((value) => new Date(value).toISOString()),
	updated_at: z.string().transform((value) => new Date(value).toISOString()),
});
export type SourceEntry = z.infer<typeof sourceEntrySchema>;
export function deterministicPhotoId(entryId: string, ref: string) {
	const hex = createHash("sha256")
		.update(`journal:${entryId}:${ref}`)
		.digest("hex")
		.slice(0, 32);
	return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-a${hex.slice(17, 20)}-${hex.slice(20)}`;
}
export function sqlValue(value: string | number | null) {
	if (value === null) return "NULL";
	return typeof value === "number"
		? String(value)
		: `'${value.replaceAll("'", "''")}'`;
}
export interface MigratedPhoto {
	id: string;
	entryId: string;
	fileName: string;
	mimeType: string;
	byteSize: number;
	width: number;
	height: number;
	originalFile: string;
	displayFile: string;
	originalSha256: string;
	displaySha256: string;
	sourceRef: string;
}
export function migrationSql(
	entries: SourceEntry[],
	photos: MigratedPhoto[],
	timeZone: string,
) {
	timeZoneSchema.parse(timeZone);
	const statements: string[] = [];
	const seen = new Set<string>();
	for (const raw of entries) {
		const entry = sourceEntrySchema.parse(raw);
		if (seen.has(entry.id)) throw new Error(`Duplicate entry ID: ${entry.id}`);
		seen.add(entry.id);
		const refs = entry.photos ?? [];
		if (refs.length > MAX_PHOTOS || new Set(refs).size !== refs.length)
			throw new Error(
				`Resolve duplicate or excess photos for entry ${entry.id}`,
			);
		if (!(entry.content?.trim() || refs.length))
			throw new Error(`Empty source entry: ${entry.id}`);
		const values = [
			entry.id,
			entry.entry_date,
			timeZone,
			entry.content ?? "",
			entry.created_at,
			entry.updated_at,
			"migration-v1",
		].map(sqlValue);
		// Deliberately refuse overwrites. Apply once into a fresh staging database.
		statements.push(
			`INSERT INTO journal_entries(id,entry_date,time_zone,content,created_at,updated_at,last_mutation,version) VALUES (${values.join(",")},1);`,
		);
		refs.forEach((ref, position) => {
			const photo = photos.find(
				(item) => item.entryId === entry.id && item.sourceRef === ref,
			);
			if (!photo)
				throw new Error(
					`Missing original for ${entry.id}, photo ${position + 1}`,
				);
			createPhotoSchema.parse({
				id: photo.id,
				entryId: photo.entryId,
				fileName: photo.fileName,
				mimeType: photo.mimeType,
				byteSize: photo.byteSize,
			});
			const data = [
				photo.id,
				entry.id,
				photo.fileName,
				photo.mimeType,
				photo.byteSize,
				photo.width,
				photo.height,
				`display/${photo.id}/migration.webp`,
				entry.created_at,
				entry.updated_at,
			].map(sqlValue);
			statements.push(
				`INSERT INTO photos(id,draft_entry_id,file_name,mime_type,byte_size,width,height,display_key,created_at,updated_at,state) VALUES (${data.join(",")},'ready');`,
			);
			statements.push(
				`INSERT INTO journal_photos(entry_id,photo_id,position) VALUES (${sqlValue(entry.id)},${sqlValue(photo.id)},${position});`,
			);
		});
	}
	return `${statements.join("\n")}\n`;
}
