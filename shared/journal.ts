import { z } from "zod";

export const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
export const MAX_PHOTOS = 20;
export const idSchema = z.uuid();
export const dateSchema = z
	.string()
	.regex(/^\d{4}-\d{2}-\d{2}$/)
	.refine((value) => {
		const date = new Date(`${value}T12:00:00Z`);
		return (
			!Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value
		);
	}, "Use a real calendar date");
export const timeZoneSchema = z
	.string()
	.max(100)
	.refine((value) => {
		try {
			new Intl.DateTimeFormat("en", { timeZone: value });
			return true;
		} catch {
			return false;
		}
	}, "Use an IANA time zone");
export const photoSchema = z.object({
	id: idSchema,
	entryId: idSchema,
	state: z.enum([
		"pending",
		"queued",
		"processing",
		"ready",
		"failed",
		"deleting",
	]),
	fileName: z.string(),
	mimeType: z.string(),
	byteSize: z.number().int(),
	width: z.number().nullable(),
	height: z.number().nullable(),
	error: z.string().nullable(),
});
export type JournalPhoto = z.infer<typeof photoSchema>;
export const entrySchema = z.object({
	id: idSchema,
	date: dateSchema,
	timeZone: timeZoneSchema,
	content: z.string(),
	version: z.number().int().positive(),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
	photos: z.array(photoSchema),
});
export type JournalEntry = z.infer<typeof entrySchema>;
export const saveJournalSchema = z
	.object({
		id: idSchema,
		date: dateSchema,
		timeZone: timeZoneSchema,
		content: z.string().max(100_000),
		expectedVersion: z.number().int().min(0),
		photoIds: z
			.array(idSchema)
			.max(MAX_PHOTOS)
			.refine((ids) => new Set(ids).size === ids.length, "Duplicate photos"),
	})
	.strict()
	.refine(
		(input) => input.content.trim().length > 0 || input.photoIds.length > 0,
		"Add text or a photo",
	);
export type SaveJournalInput = z.infer<typeof saveJournalSchema>;
export const createPhotoSchema = z
	.object({
		id: idSchema,
		entryId: idSchema,
		fileName: z.string().min(1).max(255),
		mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/avif"]),
		byteSize: z.number().int().positive().max(MAX_PHOTO_BYTES),
	})
	.strict();
export const journalListSchema = z.object({
	entries: z.array(entrySchema),
	nextCursor: z.string().nullable(),
});
export type JournalList = z.infer<typeof journalListSchema>;
export const originalKey = (id: string) => `originals/${id}`;
export const displayKey = (id: string, generation: string) =>
	`display/${id}/${generation}.webp`;
export function localDate(now = new Date()) {
	return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
