import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { originalKey } from "../../shared/journal";
import worker, {
	assertSafeWebp,
	processPhoto,
	recoverPhotos,
	type Env,
} from "../src/index";

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
async function photo(entryId = id()) {
	const data = {
		id: id(),
		entryId,
		fileName: "memory.png",
		mimeType: "image/png",
		byteSize: 4,
	};
	expect((await request("/v1/photos", "POST", data)).status).toBe(201);
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
		const pending = await photo(data.id);
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
	it("rejects missing edits and attachments from another draft", async () => {
		expect(
			(
				await request(
					"/v1/journal",
					"POST",
					input(id(), { expectedVersion: 8 }),
				)
			).status,
		).toBe(409);
		const other = await photo();
		await bindings.DB.prepare("UPDATE photos SET state='ready' WHERE id=?")
			.bind(other.id)
			.run();
		expect(
			(
				await request(
					"/v1/journal",
					"POST",
					input(id(), { photoIds: [other.id] }),
				)
			).status,
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
		const data = await photo(entry.id);
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
	it("cleans abandoned drafts but preserves attached photos", async () => {
		const draft = await photo();
		const entry = input();
		const attached = await photo(entry.id);
		await bindings.DB.prepare(
			"UPDATE photos SET state='ready',updated_at='2020-01-01T00:00:00.000Z'",
		).run();
		await request("/v1/journal", "POST", { ...entry, photoIds: [attached.id] });
		await recoverPhotos(bindings);
		expect(
			(
				(await (await request(`/v1/photos/${draft.id}`)).json()) as {
					state: string;
				}
			).state,
		).toBe("deleting");
		expect(
			(
				(await (await request(`/v1/photos/${attached.id}`)).json()) as {
					state: string;
				}
			).state,
		).toBe("ready");
	});
	it("blocks metadata in generated WebP variants", () => {
		expect(() => assertSafeWebp(minimalWebp())).not.toThrow();
		const bytes = minimalWebp();
		bytes.set(new TextEncoder().encode("EXIF"), 12);
		expect(() => assertSafeWebp(bytes)).toThrow("metadata");
		expect(() => assertSafeWebp(new Uint8Array(4))).toThrow();
	});
});
