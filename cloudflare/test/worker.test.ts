import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { originalKey } from "../../shared/photos";
import worker, {
	assertSafeWebp,
	processPhoto,
	recoverPhotos,
	type Env,
} from "../src/index";
import { extractMetadata } from "../src/photos";

// Synthetic 8x6 JPEG: Canon EOS R6, 2024-06-01 18:30 +02:00, Sydney GPS. No real photo data.
const exifJpeg = Uint8Array.from(
	atob(
		"/9j/4QGcRXhpZgAASUkqAAgAAAAJAA8BAgAGAAAAkgAAABABAgAHAAAAigAAABIBAwABAAAAAQAAABoBBQABAAAAegAAABsBBQABAAAAggAAACgBAwABAAAAAgAAABMCAwABAAAAAQAAAGmHBAABAAAAmAAAACWIBAABAAAALgEAAAAAAAA4YwAA6AMAADhjAADoAwAARU9TIFI2AABDYW5vbgAJAACQBwAEAAAAMDIxMAOQAgAUAAAAGgEAABGQAgAHAAAAEgEAAAGRBwAEAAAAAQIDAACgBwAEAAAAMDEwMAGgAwABAAAA//8AAAKgBAABAAAACAAAAAOgBAABAAAABgAAADSkAgAIAAAACgEAAAAAAABSRiAzNW1tACswMjowMAAAMjAyNDowNjowMSAxODozMDowMAAEAAEAAgACAAAAUwAAAAIABQADAAAAfAEAAAMAAgACAAAARQAAAAQABQADAAAAZAEAAAAAAACXAAAAAQAAAAwAAAABAAAAJAAAAAEAAAAhAAAAAQAAADMAAAABAAAAAAAAAAEAAAD/2wBDABQODxIPDRQSEBIXFRQYHjIhHhwcHj0sLiQySUBMS0dARkVQWnNiUFVtVkVGZIhlbXd7gYKBTmCNl4x9lnN+gXz/2wBDARUXFx4aHjshITt8U0ZTfHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHz/wAARCAAGAAgDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAT/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFQEBAQAAAAAAAAAAAAAAAAAABAX/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIRAxEAPwCMAVdf/9k=",
	),
	(c) => c.charCodeAt(0),
);

const bindings = env as unknown as Env & {
	TEST_MIGRATIONS: Parameters<typeof applyD1Migrations>[1];
};
const secret = "local-worker-test-secret-at-least-32-characters";
const token = { Authorization: `Bearer ${secret}` };
const id = () => crypto.randomUUID();
function input(entryId = id(), overrides = {}) {
	return {
		id: entryId,
		date: "2026-04-16",
		content: "A private thought",
		expectedVersion: 0,
		photoIds: [],
		...overrides,
	};
}
async function request(
	path: string,
	method = "GET",
	body?: unknown,
	headers = token,
	customEnv: Env = bindings,
) {
	return worker.fetch(
		new Request(`https://worker.test${path}`, {
			method,
			headers: {
				...headers,
				...(body ? { "Content-Type": "application/json" } : {}),
			},
			...(body ? { body: JSON.stringify(body) } : {}),
		}),
		customEnv,
	);
}
async function photo() {
	const data = {
		id: id(),
		fileName: "memory.png",
		mimeType: "image/png",
		byteSize: 4,
	};
	expect((await request("/v1/photos", "POST", data)).status).toBe(201);
	return data;
}
async function state(photoId: string) {
	return (
		(await (await request(`/v1/photos/${photoId}`)).json()) as {
			state: string;
		}
	).state;
}
async function readyPhoto() {
	const data = await photo();
	await bindings.DB.prepare(
		"UPDATE photos SET state='ready',generation=? WHERE id=?",
	)
		.bind(crypto.randomUUID(), data.id)
		.run();
	return data;
}
function minimalWebp() {
	const bytes = new Uint8Array(22);
	bytes.set(new TextEncoder().encode("RIFF"), 0);
	bytes.set(new TextEncoder().encode("WEBPVP8 "), 8);
	const view = new DataView(bytes.buffer);
	view.setUint32(4, 14, true);
	view.setUint32(16, 2, true);
	return bytes;
}
function fakeImages(format = "png") {
	return {
		info: vi.fn(async (stream: ReadableStream) => {
			await new Response(stream).arrayBuffer();
			return { format, width: 20, height: 10, fileSize: 4 };
		}),
		input: vi.fn((stream: ReadableStream) => {
			const chain = { transform: vi.fn(), output: vi.fn() };
			chain.transform.mockReturnValue(chain);
			chain.output.mockImplementation(async () => {
				await new Response(stream).arrayBuffer();
				return { response: () => new Response(minimalWebp()) };
			});
			return chain;
		}),
	} as unknown as ImagesBinding;
}
beforeAll(async () => {
	await applyD1Migrations(bindings.DB, bindings.TEST_MIGRATIONS);
});

describe("Worker boundary", () => {
	it("rejects anonymous, incorrect, missing, and placeholder secrets on every route", async () => {
		for (const path of [
			"/v1/health",
			"/v1/journal",
			`/v1/photos/${id()}/display`,
			"/unknown",
		]) {
			expect(
				(await request(path, "GET", undefined, {} as typeof token)).status,
			).toBe(401);
			expect(
				(
					await request(path, "GET", undefined, {
						Authorization: "Bearer wrong",
					})
				).status,
			).toBe(401);
		}
		expect(
			(
				await request("/v1/health", "GET", undefined, token, {
					...bindings,
					WORKER_API_SECRET: "",
				})
			).status,
		).toBe(401);
		expect(
			(
				await request("/v1/health", "GET", undefined, token, {
					...bindings,
					WORKER_API_SECRET: "REPLACE_WITH_SECRET_32_CHARACTERS_LONG",
				})
			).status,
		).toBe(401);
		const response = await request("/v1/health");
		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe("private, no-store");
	});
	it("validates real dates, size limits, and unknown fields", async () => {
		for (const overrides of [
			{ date: "2026-02-30" },
			{ content: "" },
			{ content: "a".repeat(100001) },
			{ sql: "DROP TABLE photos" },
		])
			expect(
				(await request("/v1/journal", "POST", input(id(), overrides))).status,
			).toBe(400);
		expect((await request("/v1/journal?limit=1000")).status).toBe(400);
		expect((await request("/v1/journal?cursor=invalid")).status).toBe(400);
	});
});
describe("Journal transactions", () => {
	it("creates, retries safely, edits with a version, and refuses stale changes/deletes", async () => {
		const data = input();
		const first = (await (
			await request("/v1/journal", "POST", data)
		).json()) as { version: number; date: string };
		expect(first.version).toBe(1);
		expect(first.date).toBe("2026-04-16");
		expect(
			(
				(await (await request("/v1/journal", "POST", data)).json()) as {
					version: number;
				}
			).version,
		).toBe(1);
		const changed = { ...data, content: "Updated", expectedVersion: 1 };
		expect(
			(
				(await (await request("/v1/journal", "POST", changed)).json()) as {
					version: number;
				}
			).version,
		).toBe(2);
		expect(
			(
				await request("/v1/journal", "POST", {
					...changed,
					content: "Stale overwrite",
				})
			).status,
		).toBe(409);
		expect(
			(await request(`/v1/journal/${data.id}?expectedVersion=1`, "DELETE"))
				.status,
		).toBe(409);
		expect(
			(await request(`/v1/journal/${data.id}?expectedVersion=2`, "DELETE"))
				.status,
		).toBe(204);
		expect((await request(`/v1/journal/${data.id}`)).status).toBe(404);
	});
	it("rolls back entry creation/update when attachments are invalid", async () => {
		const data = input();
		const pending = await photo();
		expect(
			(
				await request("/v1/journal", "POST", {
					...data,
					photoIds: [pending.id],
				})
			).status,
		).toBe(409);
		expect((await request(`/v1/journal/${data.id}`)).status).toBe(404);
		expect((await request("/v1/journal", "POST", data)).status).toBe(200);
		expect(
			(
				await request("/v1/journal", "POST", {
					...data,
					content: "Must roll back",
					expectedVersion: 1,
					photoIds: [pending.id],
				})
			).status,
		).toBe(409);
		const preserved = (await (
			await request(`/v1/journal/${data.id}`)
		).json()) as { version: number; content: string };
		expect(preserved.version).toBe(1);
		expect(preserved.content).toBe(data.content);
	});
	it("rejects missing edits and unknown photos", async () => {
		expect(
			(
				await request(
					"/v1/journal",
					"POST",
					input(id(), { expectedVersion: 8 }),
				)
			).status,
		).toBe(409);
		expect(
			(await request("/v1/journal", "POST", input(id(), { photoIds: [id()] })))
				.status,
		).toBe(409);
	});
	it("pages consistently across equal timestamps and filters by local date", async () => {
		for (let index = 0; index < 5; index++)
			await request(
				"/v1/journal",
				"POST",
				input(id(), { date: index === 4 ? "2026-04-17" : "2026-04-16" }),
			);
		const seen = new Set<string>();
		let cursor: string | null = null;
		do {
			const page: {
				entries: { id: string; date: string }[];
				nextCursor: string | null;
			} = await (
				await request(
					`/v1/journal?date=2026-04-16&limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ""}`,
				)
			).json();
			for (const entry of page.entries) {
				expect(entry.date).toBe("2026-04-16");
				expect(seen.has(entry.id)).toBe(false);
				seen.add(entry.id);
			}
			cursor = page.nextCursor;
		} while (cursor);
		expect(seen.size).toBe(4);
	});
});
describe("Private photo lifecycle", () => {
	it("rejects missing/incorrect uploads and records an outbox even when queue dispatch fails", async () => {
		const data = await photo();
		expect(
			(await request(`/v1/photos/${data.id}/complete`, "POST")).status,
		).toBe(409);
		await bindings.PHOTOS.put(originalKey(data.id), new Uint8Array(3), {
			httpMetadata: { contentType: "image/png" },
		});
		expect(
			(await request(`/v1/photos/${data.id}/complete`, "POST")).status,
		).toBe(400);
		await bindings.PHOTOS.put(originalKey(data.id), new Uint8Array(4), {
			httpMetadata: { contentType: "image/png" },
		});
		const broken = {
			...bindings,
			PHOTO_QUEUE: {
				send: vi.fn().mockRejectedValue(new Error("offline")),
			} as unknown as Env["PHOTO_QUEUE"],
		};
		expect(
			(
				await request(
					`/v1/photos/${data.id}/complete`,
					"POST",
					undefined,
					token,
					broken,
				)
			).status,
		).toBe(200);
		const queued = (await (await request(`/v1/photos/${data.id}`)).json()) as {
			state: string;
		};
		expect(queued.state).toBe("queued");
		const send = vi.fn().mockResolvedValue(undefined);
		await recoverPhotos({
			...bindings,
			PHOTO_QUEUE: { send } as unknown as Env["PHOTO_QUEUE"],
		});
		expect(send).toHaveBeenCalledWith({ id: data.id });
	});
	it("processes once, serves only a private variant, attaches, and deletes durably", async () => {
		const entry = input();
		const data = await photo();
		await bindings.PHOTOS.put(originalKey(data.id), new Uint8Array(4), {
			httpMetadata: { contentType: "image/png" },
		});
		await bindings.DB.prepare("UPDATE photos SET state='queued' WHERE id=?")
			.bind(data.id)
			.run();
		const images = fakeImages();
		const processingEnv = { ...bindings, IMAGES: images };
		await processPhoto(processingEnv, data.id);
		await processPhoto(processingEnv, data.id);
		expect(images.info).toHaveBeenCalledTimes(1);
		expect(images.input).toHaveBeenCalledTimes(2);
		const thumb = await request(`/v1/photos/${data.id}/thumb`);
		expect(thumb.status).toBe(200);
		await thumb.arrayBuffer();
		const display = await request(`/v1/photos/${data.id}/display`);
		expect(display.status).toBe(200);
		expect(display.headers.get("cache-control")).toBe("private, no-store");
		expect(display.headers.get("content-type")).toBe("image/webp");
		await display.arrayBuffer();
		expect(
			(await request("/v1/journal", "POST", { ...entry, photoIds: [data.id] }))
				.status,
		).toBe(200);
		expect((await request(`/v1/photos/${data.id}`, "DELETE")).status).toBe(409);
		expect(
			(await request(`/v1/journal/${entry.id}?expectedVersion=1`, "DELETE"))
				.status,
		).toBe(204);
		expect((await request(`/v1/photos/${data.id}/display`)).status).toBe(409);
		await recoverPhotos(bindings);
		expect(await bindings.PHOTOS.head(originalKey(data.id))).toBeNull();
	});
	it("checks content type and dimensions, supports manual retry, and prevents deleted-job resurrection", async () => {
		const data = await photo();
		await bindings.PHOTOS.put(originalKey(data.id), new Uint8Array(4), {
			httpMetadata: { contentType: "image/png" },
		});
		await bindings.DB.prepare(
			"UPDATE photos SET state='queued',attempts=4 WHERE id=?",
		)
			.bind(data.id)
			.run();
		const images = fakeImages("image/svg+xml");
		await expect(
			processPhoto({ ...bindings, IMAGES: images }, data.id),
		).rejects.toThrow();
		expect(
			(
				(await (await request(`/v1/photos/${data.id}`)).json()) as {
					state: string;
				}
			).state,
		).toBe("failed");
		expect((await request(`/v1/photos/${data.id}/retry`, "POST")).status).toBe(
			200,
		);
		await request(`/v1/photos/${data.id}`, "DELETE");
		await processPhoto({ ...bindings, IMAGES: fakeImages() }, data.id);
		expect(
			(
				(await (await request(`/v1/photos/${data.id}`)).json()) as {
					state: string;
				}
			).state,
		).toBe("deleting");
	});
	it("cleans abandoned uploads but keeps ready library photos", async () => {
		const abandoned = await photo();
		const library = await photo();
		await bindings.DB.prepare(
			"UPDATE photos SET updated_at='2020-01-01T00:00:00.000Z' WHERE id IN (?,?)",
		)
			.bind(abandoned.id, library.id)
			.run();
		await bindings.DB.prepare("UPDATE photos SET state='ready' WHERE id=?")
			.bind(library.id)
			.run();
		await recoverPhotos(bindings);
		expect(await state(abandoned.id)).toBe("deleting");
		expect(await state(library.id)).toBe("ready");
	});
	it("blocks metadata in generated WebP variants", () => {
		expect(() => assertSafeWebp(minimalWebp())).not.toThrow();
		const bytes = minimalWebp();
		bytes.set(new TextEncoder().encode("EXIF"), 12);
		expect(() => assertSafeWebp(bytes)).toThrow("metadata");
		expect(() => assertSafeWebp(new Uint8Array(4))).toThrow();
	});
});
describe("Photo library", () => {
	it("extracts capture time, GPS and camera inside the Workers runtime", async () => {
		const metadata = await extractMetadata(exifJpeg.buffer);
		expect(metadata.takenAt).toBe("2024-06-01T16:30:00.000Z");
		expect(metadata.latitude).toBeCloseTo(-33.85);
		expect(metadata.longitude).toBeCloseTo(151.21);
		expect(metadata.camera).toMatchObject({ make: "Canon", model: "EOS R6" });
		expect(await extractMetadata(new Uint8Array(4).buffer)).toEqual({
			takenAt: null,
			latitude: null,
			longitude: null,
			camera: null,
		});
	});
	it("serves public variants without auth only while public and at the current generation", async () => {
		const data = await readyPhoto();
		const row = (await (await request(`/v1/photos/${data.id}`)).json()) as {
			generation: string;
		};
		const key = `display/${data.id}/${row.generation}.webp`;
		await bindings.PHOTOS.put(key, minimalWebp());
		const url = `/public/photos/${data.id}/${row.generation}/display.webp`;
		const anonymous = () => request(url, "GET", undefined, {} as typeof token);
		expect((await anonymous()).status).toBe(404);
		expect(
			(
				await request(`/v1/photos/${data.id}`, "PATCH", {
					visibility: "public",
				})
			).status,
		).toBe(200);
		const served = await anonymous();
		expect(served.status).toBe(200);
		expect(served.headers.get("cache-control")).toContain("immutable");
		await served.arrayBuffer();
		expect(
			(
				await request(
					`/public/photos/${data.id}/${crypto.randomUUID()}/display.webp`,
					"GET",
					undefined,
					{} as typeof token,
				)
			).status,
		).toBe(404);
		await request(`/v1/photos/${data.id}`, "PATCH", { visibility: "private" });
		expect((await anonymous()).status).toBe(404);
	});
	it("edits metadata, rejects unknown fields, and lists with links and filters", async () => {
		const data = await readyPhoto();
		const updated = (await (
			await request(`/v1/photos/${data.id}`, "PATCH", {
				title: "  Harbour  ",
				caption: "",
				featured: true,
			})
		).json()) as { title: string; caption: string | null; featured: boolean };
		expect(updated).toMatchObject({
			title: "Harbour",
			caption: null,
			featured: true,
		});
		expect(
			(await request(`/v1/photos/${data.id}`, "PATCH", { state: "ready" }))
				.status,
		).toBe(400);
		const entry = input(id(), { photoIds: [data.id] });
		expect((await request("/v1/journal", "POST", entry)).status).toBe(200);
		const featured = (await (
			await request("/v1/photos?featured=true&limit=200")
		).json()) as { photos: { id: string; links: unknown[] }[] };
		expect(featured.photos.find((p) => p.id === data.id)?.links).toEqual([
			{ context: "journal", contextId: entry.id },
		]);
		const unused = (await (
			await request("/v1/photos?unused=true&limit=200")
		).json()) as { photos: { id: string }[] };
		expect(unused.photos.some((p) => p.id === data.id)).toBe(false);
		expect((await request("/v1/photos?context=fits")).status).toBe(400);
	});
	it("deletes private photos dropped from an entry but keeps featured library photos", async () => {
		const own = await readyPhoto();
		const library = await readyPhoto();
		await request(`/v1/photos/${library.id}`, "PATCH", { featured: true });
		const entry = input(id(), { photoIds: [own.id, library.id] });
		await request("/v1/journal", "POST", entry);
		expect(
			(
				await request("/v1/journal", "POST", {
					...entry,
					expectedVersion: 1,
					photoIds: [],
					content: "No photos now",
				})
			).status,
		).toBe(200);
		expect(await state(own.id)).toBe("deleting");
		expect(await state(library.id)).toBe("ready");
	});
});
