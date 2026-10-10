import { z } from "zod";
import { dateSchema, idSchema } from "./common";

export const bookStatuses = ["reading", "completed", "want-to-read"] as const;
export const bookSchema = z.object({
	id: idSchema,
	title: z.string(),
	author: z.string(),
	isbn: z.string().optional(),
	coverUrl: z.string().optional(),
	description: z.string().optional(),
	categories: z.array(z.string()).optional(),
	progress: z.number().optional(),
	status: z.enum(bookStatuses),
	dateStarted: z.string(),
	dateCompleted: z.string().optional(),
	notes: z.string().optional(),
	isCurrent: z.boolean().optional(),
});
export type Book = z.infer<typeof bookSchema>;
export const bookListSchema = z.object({ books: z.array(bookSchema) });

const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.optional()
		.transform((value) => value || undefined);
export const saveBookSchema = z
	.object({
		title: z.string().trim().min(1).max(500),
		author: z.string().trim().max(500),
		isbn: optionalText(20),
		coverUrl: optionalText(2000),
		description: optionalText(20_000),
		categories: z.array(z.string().trim().max(200)).max(20).optional(),
		progress: z.number().int().min(0).max(100).optional(),
		status: z.enum(bookStatuses),
		dateStarted: dateSchema,
		dateCompleted: dateSchema.optional(),
		notes: optionalText(20_000),
		isCurrent: z.boolean().optional(),
	})
	.strip();
export type SaveBookInput = z.infer<typeof saveBookSchema>;

export const recommendationSchema = z.object({
	id: idSchema,
	bookName: z.string(),
	bookAuthor: z.string().optional(),
	bookCoverUrl: z.string().optional(),
	googleBooksId: z.string().optional(),
	recommenderName: z.string().optional(),
	comment: z.string().optional(),
	/** Milliseconds since epoch, as the public list expects. */
	timestamp: z.number(),
});
export type Recommendation = z.infer<typeof recommendationSchema>;
export const recommendationListSchema = z.object({
	recommendations: z.array(recommendationSchema),
});
/** Public form input; anyone can submit, so every field is bounded. */
export const createRecommendationSchema = z
	.object({
		bookName: z.string().trim().min(1).max(300),
		bookAuthor: optionalText(300),
		bookCoverUrl: optionalText(2000).refine(
			(value) => !value || /^https?:\/\//.test(value),
			"Cover must be a web URL",
		),
		googleBooksId: optionalText(100),
		recommenderName: optionalText(200),
		comment: optionalText(2000),
	})
	.strip();
export type CreateRecommendationInput = z.infer<
	typeof createRecommendationSchema
>;
