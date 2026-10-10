import { applyD1Migrations, env } from "cloudflare:test";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { originalKey, variantKey } from "../../shared/photos";
import { type AnalysisJob, consumeAnalysis } from "../src/analysis";
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
					featured: true,
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
		await request(`/v1/photos/${data.id}`, "PATCH", { featured: false });
		expect((await anonymous()).status).toBe(404);
	});
	it("derives visibility from use and lists a timeline with what each photo is in", async () => {
		const status = async (photoId: string) =>
			(
				(await (await request(`/v1/photos/${photoId}`)).json()) as {
					visibility: string;
				}
			).visibility;
		// Visibility can't be set directly any more.
		const [onVisit, inJournal] = [await readyPhoto(), await readyPhoto()];
		expect(
			(
				await request(`/v1/photos/${onVisit.id}`, "PATCH", {
					visibility: "public",
				})
			).status,
		).toBe(400);
		const visitId = id();
		const visit = (photoIds: string[]) =>
			request(`/v1/visits/${visitId}`, "PUT", {
				airportIdent: "KAUS",
				date: "2026-04-21",
				flightNumbers: [],
				isLayover: false,
				notes: "",
				photoIds,
			});
		await visit([onVisit.id]);
		expect(await status(onVisit.id)).toBe("public");
		await request(`/v1/photos/${onVisit.id}`, "PATCH", { hiddenFromMap: true });
		expect(await status(onVisit.id)).toBe("private");
		await request(`/v1/photos/${onVisit.id}`, "PATCH", {
			hiddenFromMap: false,
		});
		const entry = input(id(), {
			photoIds: [inJournal.id],
			content: "Lunch by the lake",
		});
		await request("/v1/journal", "POST", entry);
		expect(await status(inJournal.id)).toBe("private");

		// Newest taken first, undated last; links say which entry they are.
		await bindings.DB.prepare("UPDATE photos SET taken_at=? WHERE id=?")
			.bind("2030-01-01T00:00:00.000Z", inJournal.id)
			.run();
		await bindings.DB.prepare("UPDATE photos SET taken_at=NULL WHERE id=?")
			.bind(onVisit.id)
			.run();
		const pages: {
			id: string;
			links: { label: string | null; date: string | null }[];
		}[] = [];
		let cursor: string | null = null;
		do {
			const page = (await (
				await request(`/v1/photos?limit=2${cursor ? `&cursor=${cursor}` : ""}`)
			).json()) as { photos: typeof pages; nextCursor: string | null };
			pages.push(...page.photos);
			cursor = page.nextCursor;
		} while (cursor);
		expect(pages[0].id).toBe(inJournal.id);
		expect(pages[0].links).toEqual([
			expect.objectContaining({
				context: "journal",
				label: "Lunch by the lake",
				date: entry.date,
			}),
		]);
		expect(new Set(pages.map((p) => p.id)).size).toBe(pages.length);
		const undated = pages.findIndex((p) => p.id === onVisit.id);
		expect(pages[undated].links).toEqual([
			expect.objectContaining({
				context: "visit",
				label: "KAUS",
				date: "2026-04-21",
			}),
		]);

		// Dropped from its visit, the photo goes with it.
		await visit([]);
		expect(
			(
				(await (await request(`/v1/photos/${onVisit.id}`)).json()) as {
					state: string;
				}
			).state,
		).toBe("deleting");
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
			expect.objectContaining({ context: "journal", contextId: entry.id }),
		]);
		const unused = (await (
			await request("/v1/photos?unused=true&limit=200")
		).json()) as { photos: { id: string }[] };
		expect(unused.photos.some((p) => p.id === data.id)).toBe(false);
		// Gallery photos in no entry are still in use; plain unlinked ones are not.
		const [gallery, loose] = [await readyPhoto(), await readyPhoto()];
		await request(`/v1/photos/${gallery.id}`, "PATCH", { featured: true });
		const unusedIds = (
			(await (await request("/v1/photos?unused=true&limit=200")).json()) as {
				photos: { id: string }[];
			}
		).photos.map((p) => p.id);
		expect(unusedIds).toContain(loose.id);
		expect(unusedIds).not.toContain(gallery.id);
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
describe("Food, workouts, visits and books", () => {
	const aiEnv = { ...bindings, PRIME_API_KEY: "test-key" } as Env;
	function stubModel(answer: unknown, seen: string[] = []) {
		return vi
			.spyOn(globalThis, "fetch")
			.mockImplementation(async (resource, init) => {
				const body = JSON.parse(String(init?.body));
				seen.push(
					...body.messages[0].content
						.filter((part: { type: string }) => part.type === "image_url")
						.map((part: { image_url: { url: string } }) => part.image_url.url),
				);
				expect(String(resource)).toBe(
					"https://api.pinference.ai/api/v1/chat/completions",
				);
				expect(body.response_format.type).toBe("json_schema");
				return Response.json({
					choices: [{ message: { content: JSON.stringify(answer) } }],
				});
			});
	}
	it("saves food with photos, analyzes through a signed link, and clears stale analysis", async () => {
		const meal = await readyPhoto();
		await storeUpload(meal.id);
		const foodId = id();
		const save = (description: string, photoIds = [meal.id]) =>
			request(`/v1/food/${foodId}`, "PUT", {
				date: "2026-04-16",
				eatenAt: "2026-04-16T12:30:00.000Z",
				description,
				photoIds,
			});
		expect((await save("Avocado toast")).status).toBe(200);
		expect(
			(
				await request(`/v1/food/${id()}`, "PUT", {
					date: "2026-04-16",
					eatenAt: "2026-04-16T12:30:00.000Z",
					description: "",
					photoIds: [],
				})
			).status,
		).toBe(400);
		const seen: string[] = [];
		const spy = stubModel(
			{
				foodName: "Avocado toast",
				calories: "510 kcal",
				proteinG: 18,
				carbsG: "35g",
				fatG: 32,
				notes: "Healthy fats",
			},
			seen,
		);
		const analyzed = (await (
			await worker.fetch(
				new Request(`https://worker.test/v1/food/${foodId}/analyze`, {
					method: "POST",
					headers: token,
				}),
				aiEnv,
			)
		).json()) as { aiCalories: number; aiCarbsG: number; photos: unknown[] };
		spy.mockRestore();
		expect(analyzed).toMatchObject({ aiCalories: 510, aiCarbsG: 35 });
		expect(analyzed.photos).toHaveLength(1);
		// The model gets a short-lived link that works without the API secret.
		expect(seen).toHaveLength(1);
		const link = new URL(seen[0]);
		expect(link.pathname).toContain(`/signed/photos/${meal.id}/`);
		const fetched = await worker.fetch(new Request(link), bindings);
		expect(fetched.status).toBe(200);
		expect((await fetched.arrayBuffer()).byteLength).toBe(2);
		link.searchParams.set("sig", "0".repeat(64));
		expect((await worker.fetch(new Request(link), bindings)).status).toBe(404);
		// Same input keeps the analysis; a new description clears it.
		const kept = (await (await save("Avocado toast")).json()) as {
			aiCalories?: number;
		};
		expect(kept.aiCalories).toBe(510);
		const cleared = (await (await save("Two eggs")).json()) as {
			aiCalories?: number;
		};
		expect(cleared.aiCalories).toBeUndefined();
		const day = (await (await request("/v1/food?date=2026-04-16")).json()) as {
			entries: { id: string }[];
		};
		expect(day.entries.some((entry) => entry.id === foodId)).toBe(true);
		expect((await request(`/v1/food/${foodId}`, "DELETE")).status).toBe(204);
		expect(await state(meal.id)).toBe("deleting");
		expect((await request(`/v1/food/${foodId}`)).status).toBe(404);
	});
	it("analyzes workouts, computing volume and coercing loose numbers", async () => {
		const logId = id();
		await request(`/v1/workouts/${logId}`, "PUT", {
			date: "2026-04-16",
			content: "Goblet squat 25,35 - 8-10 reps",
			weight: 79.2,
			photoIds: [],
		});
		const spy = stubModel({
			sessionType: "strength",
			exercises: [
				{
					name: "Goblet Squat",
					category: "compound",
					muscleGroups: ["quads"],
					sets: [
						{ weight: "25", reps: "8-10" },
						{ weight: 35, reps: 9 },
						{ weight: "bodyweight", reps: 10 },
					],
				},
			],
			muscleGroups: ["quads"],
			notes: null,
		});
		const response = await worker.fetch(
			new Request(`https://worker.test/v1/workouts/${logId}/analyze`, {
				method: "POST",
				headers: token,
			}),
			aiEnv,
		);
		spy.mockRestore();
		const log = (await response.json()) as {
			weight: number;
			aiTotalVolume: number;
			aiExercises: { sets: { weight: number | null; reps: number }[] }[];
		};
		expect(log.weight).toBe(79.2);
		expect(log.aiTotalVolume).toBe(25 * 9 + 35 * 9);
		expect(log.aiExercises[0].sets[2]).toEqual({ weight: null, reps: 10 });
		expect((await request(`/v1/workouts/${id()}/analyze`, "POST")).status).toBe(
			404,
		);
	});
	it("queues analysis on save, applies it in the consumer, and retries only model failures", async () => {
		const sent: AnalysisJob[] = [];
		const queueEnv = {
			...aiEnv,
			ANALYSIS_QUEUE: { send: async (job: AnalysisJob) => sent.push(job) },
		} as unknown as Env;
		const logId = id();
		const save = (content: string) =>
			worker.fetch(
				new Request(`https://worker.test/v1/workouts/${logId}`, {
					method: "PUT",
					headers: { ...token, "Content-Type": "application/json" },
					body: JSON.stringify({
						date: "2026-04-16",
						content,
						weight: null,
						photoIds: [],
					}),
				}),
				queueEnv,
			);
		await save("Push-ups 3x20");
		expect(sent).toEqual([
			{ kind: "workouts", id: logId, origin: "https://worker.test" },
		]);
		const consume = async (job: AnalysisJob) => {
			const message = { body: job, attempts: 1, ack: vi.fn(), retry: vi.fn() };
			await consumeAnalysis(
				{ messages: [message] } as unknown as MessageBatch<AnalysisJob>,
				queueEnv,
			);
			return message;
		};
		const failing = vi
			.spyOn(globalThis, "fetch")
			.mockResolvedValue(new Response("busy", { status: 503 }));
		const failed = await consume(sent[0]);
		failing.mockRestore();
		expect(failed.retry).toHaveBeenCalled();
		expect(failed.ack).not.toHaveBeenCalled();
		const spy = stubModel({
			sessionType: "strength",
			exercises: [],
			muscleGroups: ["chest"],
			notes: "Solid",
		});
		const done = await consume(sent[0]);
		spy.mockRestore();
		expect(done.ack).toHaveBeenCalled();
		const log = (await (await request(`/v1/workouts/${logId}`)).json()) as {
			aiSessionType?: string;
		};
		expect(log.aiSessionType).toBe("strength");
		// An analyzed workout saved unchanged isn't queued again; a deleted one is dropped.
		await save("Push-ups 3x20");
		expect(sent).toHaveLength(1);
		const gone = await consume({ ...sent[0], id: id() });
		expect(gone.ack).toHaveBeenCalled();
		expect(gone.retry).not.toHaveBeenCalled();
	});
	it("refuses analysis without an API key", async () => {
		const logId = id();
		await request(`/v1/workouts/${logId}`, "PUT", {
			date: "2026-04-16",
			content: "Run",
			weight: null,
			photoIds: [],
		});
		expect(
			(await request(`/v1/workouts/${logId}/analyze`, "POST")).status,
		).toBe(503);
	});
	it("saves visits with flights and keeps a single current book", async () => {
		const visitId = id();
		const visit = (await (
			await request(`/v1/visits/${visitId}`, "PUT", {
				airportIdent: "kjfk",
				date: "2026-01-02",
				flightNumbers: ["THY 717", "THY 35"],
				isLayover: true,
				notes: "",
				photoIds: [],
			})
		).json()) as Record<string, unknown>;
		expect(visit).toMatchObject({
			airportIdent: "KJFK",
			flightNumbers: ["THY 717", "THY 35"],
			isLayover: true,
		});
		expect(visit.notes).toBeUndefined();
		const book = (title: string, isCurrent: boolean) => ({
			title,
			author: "Author",
			status: "reading",
			dateStarted: "2026-01-01",
			progress: 10,
			isCurrent,
		});
		const [first, second] = [id(), id()];
		await request(`/v1/books/${first}`, "PUT", book("One", true));
		await request(`/v1/books/${second}`, "PUT", book("Two", true));
		const current = async () =>
			(
				(await (await request("/v1/books")).json()) as {
					books: { id: string; isCurrent: boolean }[];
				}
			).books
				.filter((b) => b.isCurrent)
				.map((b) => b.id);
		expect(await current()).toEqual([second]);
		await request(`/v1/books/${first}/current`, "POST");
		expect(await current()).toEqual([first]);
		expect((await request(`/v1/books/${first}`, "DELETE")).status).toBe(204);
		expect((await request(`/v1/books/${first}`, "DELETE")).status).toBe(404);
	});
	it("lists more records than D1 binds in one query", async () => {
		for (let i = 0; i < 120; i++)
			await request(`/v1/visits/${id()}`, "PUT", {
				airportIdent: "KJFK",
				date: "2026-01-02",
				flightNumbers: [],
				isLayover: false,
				notes: "",
				photoIds: [],
			});
		const response = await request("/v1/visits");
		expect(response.status).toBe(200);
		expect(
			((await response.json()) as { visits: unknown[] }).visits.length,
		).toBeGreaterThanOrEqual(120);
	});
	it("accepts bounded public recommendations", async () => {
		expect(
			(await request("/v1/recommendations", "POST", { bookName: "" })).status,
		).toBe(400);
		expect(
			(
				await request("/v1/recommendations", "POST", {
					bookName: "Dune",
					bookCoverUrl: "javascript:alert(1)",
				})
			).status,
		).toBe(400);
		const created = (await (
			await request("/v1/recommendations", "POST", {
				bookName: "Dune",
				recommenderName: " Sam ",
			})
		).json()) as { id: string };
		const list = (await (await request("/v1/recommendations")).json()) as {
			recommendations: { id: string; recommenderName: string }[];
		};
		expect(list.recommendations.find((r) => r.id === created.id)).toMatchObject(
			{ recommenderName: "Sam" },
		);
		expect(
			(await request(`/v1/recommendations/${created.id}`, "DELETE")).status,
		).toBe(204);
	});
});
