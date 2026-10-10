import { z } from "zod";
import { dateSchema, idSchema } from "./common";
import { photoIdsSchema, photoSchema } from "./photos";

export const entrySchema = z.object({
	id: idSchema,
	date: dateSchema,
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
		content: z.string().max(100_000),
		expectedVersion: z.number().int().min(0),
		photoIds: photoIdsSchema,
	})
	.strict()
	.refine(
		(input) => input.content.trim().length > 0 || input.photoIds.length > 0,
		"Add text or a photo",
	);
export type SaveJournalInput = z.infer<typeof saveJournalSchema>;
export const journalListSchema = z.object({
	entries: z.array(entrySchema),
	nextCursor: z.string().nullable(),
});
export type JournalList = z.infer<typeof journalListSchema>;
