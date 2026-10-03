import { describe, expect, it } from "vitest";
import {
	deterministicPhotoId,
	migrationSql,
	sqlValue,
} from "../../lib/migration/plan";
import { idSchema } from "../../shared/journal";

const entry = {
	id: "13d1bb2a-3b94-4a65-892f-86505e69b964",
	entry_date: "2026-04-16",
	content: "Don't lose my thoughts",
	photos: null,
	created_at: "2026-04-16T02:30:00.000Z",
	updated_at: "2026-04-16T04:00:00.000Z",
};
describe("Migration plan", () => {
	it("preserves IDs, dates and historical timestamps without overwrites", () => {
		const sql = migrationSql([entry], [], "America/Los_Angeles");
		for (const value of [
			entry.id,
			entry.entry_date,
			entry.created_at,
			entry.updated_at,
			"America/Los_Angeles",
		])
			expect(sql).toContain(value);
		expect(sql).toContain("Don''t lose my thoughts");
		expect(sql).not.toContain("ON CONFLICT");
	});
	it("does not silently omit missing originals or empty records", () => {
		expect(() =>
			migrationSql(
				[{ ...entry, photos: ["sb://private/missing.jpg"] }],
				[],
				"UTC",
			),
		).toThrow("Missing original");
		expect(() =>
			migrationSql([{ ...entry, content: null }], [], "UTC"),
		).toThrow("Empty source entry");
		expect(() => migrationSql([entry, entry], [], "UTC")).toThrow(
			"Duplicate entry",
		);
	});
	it("uses repeatable photo IDs per real entry and storage reference", () => {
		const id = deterministicPhotoId(entry.id, "sb://private/photo.jpg");
		expect(idSchema.safeParse(id).success).toBe(true);
		expect(deterministicPhotoId(entry.id, "sb://private/photo.jpg")).toBe(id);
		expect(
			deterministicPhotoId(crypto.randomUUID(), "sb://private/photo.jpg"),
		).not.toBe(id);
	});
	it("escapes SQL values instead of interpolating unquoted input", () => {
		expect(sqlValue("'); DROP TABLE photos;--")).toBe(
			"'''); DROP TABLE photos;--'",
		);
	});
});
