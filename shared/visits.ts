import { z } from "zod";
import { dateSchema, idSchema } from "./common";
import { photoIdsSchema, photoSchema } from "./photos";

export const visitSchema = z.object({
	id: idSchema,
	airportIdent: z.string(),
	date: dateSchema,
	flightNumbers: z.array(z.string()),
	isLayover: z.boolean(),
	notes: z.string().optional(),
	photos: z.array(photoSchema),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
});
export type Visit = z.infer<typeof visitSchema>;
export const visitListSchema = z.object({ visits: z.array(visitSchema) });

export const saveVisitSchema = z
	.object({
		airportIdent: z
			.string()
			.trim()
			.min(1)
			.max(16)
			.regex(/^[A-Za-z0-9-]+$/),
		date: dateSchema,
		flightNumbers: z.array(z.string().trim().min(1).max(20)).max(10),
		isLayover: z.boolean(),
		notes: z.string().trim().max(10_000),
		photoIds: photoIdsSchema,
	})
	.strict();
export type SaveVisitInput = z.infer<typeof saveVisitSchema>;
