import { z } from "zod";
import { idSchema } from "./common";

export const MAX_PHOTO_BYTES = 20 * 1024 * 1024;
export const MAX_PHOTOS = 20;
export const MAX_VARIANT_BYTES = 8 * 1024 * 1024;
export const variantSizes = { display: 2048, thumb: 480 } as const;
export const photoContexts = ["journal", "food", "workout", "flight"] as const;
export type PhotoContext = (typeof photoContexts)[number];
export const photoVariants = ["display", "thumb"] as const;
export type PhotoVariant = (typeof photoVariants)[number];

export const cameraSchema = z
	.object({
		make: z.string().nullable(),
		model: z.string().nullable(),
		lens: z.string().nullable(),
		fNumber: z.number().nullable(),
		exposureTime: z.number().nullable(),
		iso: z.number().nullable(),
	})
	.partial();
export type Camera = z.infer<typeof cameraSchema>;

export const photoSchema = z.object({
	id: idSchema,
	state: z.enum(["pending", "ready", "deleting"]),
	fileName: z.string(),
	mimeType: z.string(),
	byteSize: z.number().int(),
	width: z.number().nullable(),
	height: z.number().nullable(),
	// Changes whenever variants are regenerated; part of public URLs so they can be cached forever.
	generation: z.string().nullable(),
	visibility: z.enum(["private", "public"]),
	featured: z.boolean(),
	title: z.string().nullable(),
	caption: z.string().nullable(),
	location: z.string().nullable(),
	takenAt: z.iso.datetime().nullable(),
	latitude: z.number().nullable(),
	longitude: z.number().nullable(),
	showLocation: z.boolean(),
	/** Flight photos are public on the airports map unless hidden from it. */
	hiddenFromMap: z.boolean(),
	camera: cameraSchema.nullable(),
	createdAt: z.iso.datetime(),
});
export type Photo = z.infer<typeof photoSchema>;

export const photoLinkSchema = z.object({
	context: z.enum(photoContexts),
	contextId: z.string(),
	/** The entry's date and a short label (food name, airport, first words), when it exists. */
	date: z.string().nullable().optional(),
	label: z.string().nullable().optional(),
});
export const libraryPhotoSchema = photoSchema.extend({
	links: z.array(photoLinkSchema),
});
export type LibraryPhoto = z.infer<typeof libraryPhotoSchema>;
export const photoListSchema = z.object({
	photos: z.array(libraryPhotoSchema),
	nextCursor: z.string().nullable(),
});
export type PhotoList = z.infer<typeof photoListSchema>;

export const createPhotoSchema = z
	.object({
		id: idSchema,
		fileName: z.string().min(1).max(255),
		mimeType: z.enum(["image/jpeg", "image/png", "image/webp", "image/avif"]),
		byteSize: z.number().int().positive().max(MAX_PHOTO_BYTES),
	})
	.strict();
/** Variants are resized in the browser; canvas encoding never writes EXIF/GPS. */
export const variantTypes = ["image/webp", "image/jpeg"] as const;
const variantFileSchema = z.object({
	type: z.enum(variantTypes),
	size: z.number().int().positive().max(MAX_VARIANT_BYTES),
});
export const uploadPhotoSchema = createPhotoSchema
	.extend({ display: variantFileSchema, thumb: variantFileSchema })
	.strict();
export type UploadPhotoInput = z.infer<typeof uploadPhotoSchema>;
export const completePhotoSchema = z
	.object({
		width: z.number().int().positive().max(20_000),
		height: z.number().int().positive().max(20_000),
		takenAt: z.iso.datetime().nullable(),
		latitude: z.number().min(-90).max(90).nullable(),
		longitude: z.number().min(-180).max(180).nullable(),
		camera: cameraSchema.nullable(),
	})
	.strict();
export type CompletePhotoInput = z.infer<typeof completePhotoSchema>;
const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.transform((value) => value || null)
		.nullable();
export const updatePhotoSchema = z
	.object({
		// Visibility is not set directly: it follows the gallery and flight use.
		featured: z.boolean(),
		hiddenFromMap: z.boolean(),
		title: optionalText(200),
		caption: optionalText(2000),
		location: optionalText(200),
		showLocation: z.boolean(),
	})
	.partial()
	.strict();
export type UpdatePhotoInput = z.infer<typeof updatePhotoSchema>;
export const photoIdsSchema = z
	.array(idSchema)
	.max(MAX_PHOTOS)
	.refine((ids) => new Set(ids).size === ids.length, "Duplicate photos");

export const originalKey = (id: string) => `originals/${id}`;
export const variantPrefix = (id: string) => `variants/${id}/`;
export const variantKey = (
	id: string,
	generation: string,
	variant: PhotoVariant,
) => `${variantPrefix(id)}${generation}/${variant}`;
