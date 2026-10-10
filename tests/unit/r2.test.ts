import { afterEach, describe, expect, it, vi } from "vitest";
import { photoUploadUrl } from "../../lib/backend/r2";
import type { Photo } from "../../shared/photos";

const photo: Photo = {
	id: "650241be-cfeb-42be-99a3-592fe9496b0f",
	state: "pending",
	fileName: "memory.jpg",
	mimeType: "image/jpeg",
	byteSize: 1024,
	width: null,
	height: null,
	error: null,
	generation: null,
	visibility: "private",
	featured: false,
	title: null,
	caption: null,
	location: null,
	takenAt: null,
	latitude: null,
	longitude: null,
	showLocation: false,
	camera: null,
	createdAt: "2026-10-10T00:00:00.000Z",
};
function configure() {
	vi.stubEnv("R2_ACCOUNT_ID", "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa");
	vi.stubEnv("PRIVATE_R2_ACCESS_KEY_ID", "test-private-bucket-key");
	vi.stubEnv("PRIVATE_R2_SECRET_ACCESS_KEY", "test-private-bucket-secret");
	vi.stubEnv("PRIVATE_R2_BUCKET", "personal-website-production-private");
	vi.stubEnv("R2_BUCKET", "site-assets");
}
afterEach(() => vi.unstubAllEnvs());
describe("Private R2 upload authorization", () => {
	it("signs immutable, bounded uploads to a private bucket for five minutes", async () => {
		configure();
		const url = new URL(await photoUploadUrl(photo));
		expect(url.protocol).toBe("https:");
		expect(url.pathname).toContain(`/originals/${photo.id}`);
		expect(url.searchParams.get("X-Amz-Expires")).toBe("300");
		expect(url.searchParams.has("x-amz-checksum-crc32")).toBe(false);
		const headers = url.searchParams.get("X-Amz-SignedHeaders");
		for (const header of ["content-length", "content-type", "if-none-match"])
			expect(headers).toContain(header);
		expect(url.toString()).not.toContain("test-private-bucket-secret");
	});
	it("refuses the existing public bucket and missing credentials", async () => {
		configure();
		vi.stubEnv("PRIVATE_R2_BUCKET", "site-assets");
		await expect(photoUploadUrl(photo)).rejects.toMatchObject({ status: 503 });
		configure();
		vi.stubEnv("PRIVATE_R2_SECRET_ACCESS_KEY", "");
		await expect(photoUploadUrl(photo)).rejects.toMatchObject({ status: 503 });
	});
});
