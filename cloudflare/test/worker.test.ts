import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { originalKey, variantKey } from "../../shared/photos";
import worker, { cleanupPhotos, type Env } from "../src/index";

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
const metadata = {
	width: 20,
	height: 10,
	takenAt: "2024-06-01T16:30:00.000Z",
	latitude: -33.85,
	longitude: 151.21,
	camera: { make: "Canon", model: "EOS R6" },
};
async function storeUpload(
	photoId: string,
	{ size = 4, type = "image/png", variant = "image/webp" } = {},
) {
	const row = (await (await request(`/v1/photos/${photoId}`)).json()) as {
		generation: string;
	};
	await bindings.PHOTOS.put(originalKey(photoId), new Uint8Array(size), {
		httpMetadata: { contentType: type },
	});
	for (const name of ["display", "thumb"] as const)
		await bindings.PHOTOS.put(
			variantKey(photoId, row.generation, name),
			new Uint8Array(2),
			{ httpMetadata: { contentType: variant } },
		);
	return row.generation;
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
	it("completes only when the original and both variants match the declaration", async () => {
		const data = await photo();
		const complete = () =>
			request(`/v1/photos/${data.id}/complete`, "POST", metadata);
		expect((await complete()).status).toBe(409);
		await storeUpload(data.id, { size: 3 });
		expect((await complete()).status).toBe(400);
		await bindings.PHOTOS.delete(originalKey(data.id));
		await storeUpload(data.id, { variant: "image/png" });
		expect((await complete()).status).toBe(400);
		await storeUpload(data.id, { variant: "image/jpeg" });
		const done = (await (await complete()).json()) as {
			state: string;
			takenAt: string;
			camera: { make: string };
		};
		expect(done).toMatchObject({
			state: "ready",
			takenAt: metadata.takenAt,
			camera: { make: "Canon" },
		});
		expect((await complete()).status).toBe(200);
		expect(
			(
				await request(`/v1/photos/${data.id}/complete`, "POST", {
					...metadata,
					latitude: 120,
				})
			).status,
		).toBe(400);
	});
	it("serves private variants with their stored type, attaches, and deletes durably", async () => {
		const entry = input();
		const data = await photo();
		await storeUpload(data.id, { variant: "image/jpeg" });
		await request(`/v1/photos/${data.id}/complete`, "POST", metadata);
		for (const variant of ["display", "thumb"]) {
			const response = await request(`/v1/photos/${data.id}/${variant}`);
			expect(response.status).toBe(200);
			expect(response.headers.get("cache-control")).toBe("private, no-store");
			expect(response.headers.get("content-type")).toBe("image/jpeg");
			await response.arrayBuffer();
		}
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
		await bindings.DB.prepare(
			"UPDATE photos SET updated_at='2020-01-01T00:00:00.000Z' WHERE id=?",
		)
			.bind(data.id)
			.run();
		await cleanupPhotos(bindings);
		expect(await bindings.PHOTOS.head(originalKey(data.id))).toBeNull();
		expect((await request(`/v1/photos/${data.id}`)).status).toBe(404);
	});
	it("cleans abandoned uploads but keeps ready library photos", async () => {
		const abandoned = await photo();
		const library = await readyPhoto();
		await bindings.DB.prepare(
			"UPDATE photos SET updated_at='2020-01-01T00:00:00.000Z' WHERE id IN (?,?)",
		)
			.bind(abandoned.id, library.id)
			.run();
		await cleanupPhotos(bindings);
		expect(await state(abandoned.id)).toBe("deleting");
		expect(await state(library.id)).toBe("ready");
	});
});
describe("Photo library", () => {
	it("serves public variants without auth only while public and at the current generation", async () => {
		const data = await readyPhoto();
		const row = (await (await request(`/v1/photos/${data.id}`)).json()) as {
			generation: string;
		};
		await bindings.PHOTOS.put(
			variantKey(data.id, row.generation, "display"),
			new Uint8Array(2),
			{ httpMetadata: { contentType: "image/webp" } },
		);
		const url = `/public/photos/${data.id}/${row.generation}/display`;
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
					`/public/photos/${data.id}/${crypto.randomUUID()}/display`,
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
