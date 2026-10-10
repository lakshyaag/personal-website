import { afterEach, describe, expect, it, vi } from "vitest";
import { photoUploadUrls } from "../../lib/backend/r2";
import type { Photo } from "../../shared/photos";

const photo: Photo = {
	id: "650241be-cfeb-42be-99a3-592fe9496b0f",
	state: "pending",
	fileName: "memory.jpg",
	mimeType: "image/jpeg",
	byteSize: 1024,
	width: null,
	height: null,
	generation: "9d7cf7a1-0a4f-4f0e-9a35-4f3c8b1e2d10",
	visibility: "private",
	featured: false,
	title: null,
	caption: null,
	location: null,
	takenAt: null,
	latitude: null,
	longitude: null,
	showLocation: false,
	hiddenFromMap: false,
	camera: null,
	createdAt: "2026-10-10T00:00:00.000Z",
};
const input = {
	id: photo.id,
	fileName: photo.fileName,
	mimeType: "image/jpeg" as const,
	byteSize: photo.byteSize,
	display: { type: "image/webp" as const, size: 300 },
	thumb: { type: "image/jpeg" as const, size: 40 },
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
		const urls = await photoUploadUrls(photo, input);
		expect(urls.thumb.headers["Content-Type"]).toBe("image/jpeg");
		expect(new URL(urls.display.url).pathname).toContain(
			`/variants/${photo.id}/${photo.generation}/display`,
		);
		const url = new URL(urls.original.url);
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
		await expect(photoUploadUrls(photo, input)).rejects.toMatchObject({
			status: 503,
		});
		configure();
		vi.stubEnv("PRIVATE_R2_SECRET_ACCESS_KEY", "");
		await expect(photoUploadUrls(photo, input)).rejects.toMatchObject({
			status: 503,
		});
	});
});
