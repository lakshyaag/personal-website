import { describe, expect, it } from "vitest";
import {
	ownerAllowed,
	safeRedirect,
	validSecret,
} from "../../lib/migration/config";
import {
	MAX_PHOTO_BYTES,
	createPhotoSchema,
	dateSchema,
	localDate,
	saveJournalSchema,
	timeZoneSchema,
} from "../../shared/journal";

describe("Journal contracts", () => {
	it("rejects impossible dates while preserving a selected local calendar day", () => {
		expect(dateSchema.safeParse("2026-02-30").success).toBe(false);
		expect(dateSchema.safeParse("2024-02-29").success).toBe(true);
		expect(dateSchema.safeParse("2025-02-29").success).toBe(false);
		expect(localDate(new Date(2026, 3, 16, 0, 5))).toBe("2026-04-16");
		expect(timeZoneSchema.safeParse("America/Los_Angeles").success).toBe(true);
		expect(timeZoneSchema.safeParse("invalid").success).toBe(false);
	});
	it("separates editable fields and requires distinct photos", () => {
		const id = crypto.randomUUID();
		const photoId = crypto.randomUUID();
		const input = {
			id,
			date: "2026-04-16",
			timeZone: "UTC",
			content: "Thoughts",
			expectedVersion: 0,
			photoIds: [],
		};
		expect(saveJournalSchema.safeParse(input).success).toBe(true);
		expect(
			saveJournalSchema.safeParse({
				...input,
				createdAt: new Date().toISOString(),
			}).success,
		).toBe(false);
		expect(
			saveJournalSchema.safeParse({ ...input, photoIds: [photoId, photoId] })
				.success,
		).toBe(false);
		expect(
			saveJournalSchema.safeParse({ ...input, content: " " }).success,
		).toBe(false);
	});
	it("limits uploaded image types and sizes", () => {
		const data = {
			id: crypto.randomUUID(),
			entryId: crypto.randomUUID(),
			fileName: "memory.png",
			mimeType: "image/png",
			byteSize: 4,
		};
		expect(createPhotoSchema.safeParse(data).success).toBe(true);
		expect(
			createPhotoSchema.safeParse({ ...data, byteSize: MAX_PHOTO_BYTES + 1 })
				.success,
		).toBe(false);
		expect(
			createPhotoSchema.safeParse({ ...data, mimeType: "image/svg+xml" })
				.success,
		).toBe(false);
	});
});
describe("Owner-only access", () => {
	it("uses the immutable numeric ID, fails closed, and does not accept usernames", () => {
		expect(ownerAllowed(123, "123")).toBe(true);
		expect(ownerAllowed(456, "123")).toBe(false);
		expect(ownerAllowed("lakshyaag", "lakshyaag")).toBe(false);
		expect(ownerAllowed(undefined, undefined)).toBe(false);
		expect(validSecret("REPLACE_WITH_RANDOM_SECRET_32_CHARS")).toBe(false);
		expect(validSecret("short")).toBe(false);
	});
	it("rejects open redirects and encoded path escapes", () => {
		for (const bad of [
			"https://evil.example",
			"//evil.example",
			"/admin\\evil",
			"/admin/../api/delete",
			"/administrator",
			"/admin/login",
			"/admin/%2e%2e/api/delete",
		])
			expect(safeRedirect(bad)).toBe("/admin/journal");
		expect(safeRedirect("/admin/journal?edit=abc")).toBe(
			"/admin/journal?edit=abc",
		);
	});
});
