// One-off: copy food, workouts, visits, books and recommendations from Supabase into the shared
// D1 database. Read-only against Supabase. Idempotent: rows upsert by ID, so it can be re-run
// right before cutover (it overwrites D1 rows with the Supabase version).
//   bun --env-file=.env.local scripts/migrate/records.ts plan|apply|verify
// Photos were imported by photos.ts, but Supabase's photo_attachments are keyed by upload folder
// (a date or airport code), not by entry. So food/workout/visit links are rebuilt here from each
// entry's own `photos` refs, resolved to photo IDs through photo_derivatives.
import { createClient } from "@supabase/supabase-js";
import { d1, d1Batch } from "./d1";

const mode = process.argv[2];
if (!["plan", "apply", "verify"].includes(mode ?? ""))
	throw new Error("Usage: records.ts plan|apply|verify");

const supabase = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
	process.env.SUPABASE_SERVICE_ROLE_KEY ?? "",
	{ auth: { persistSession: false } },
);
type Row = Record<string, unknown>;
async function all(table: string) {
	const { data, error } = await supabase.from(table).select("*");
	if (error) throw new Error(`${table}: ${error.message}`);
	return data as Row[];
}
const iso = (value: unknown) =>
	value ? new Date(String(value)).toISOString() : null;
const json = (value: unknown) => JSON.stringify(value ?? []);
const text = (value: unknown) =>
	typeof value === "string" && value.trim() ? value : null;
const num = (value: unknown) =>
	value === null || value === undefined ? null : Number(value);
const day = (value: unknown) => (value ? String(value).slice(0, 10) : null);

/** Each table: Supabase source, D1 target and column mapping (D1 column -> value). */
const tables: {
	source: string;
	target: string;
	context?: "food" | "workout" | "visit";
	map: (row: Row) => Record<string, string | number | null>;
}[] = [
	{
		source: "food_entries",
		target: "food_entries",
		context: "food",
		map: (r) => ({
			id: String(r.id),
			entry_date: day(r.entry_date),
			// Legacy created_at was the meal time picked in the form.
			eaten_at: iso(r.created_at),
			description: text(r.description),
			ai_food_name: text(r.ai_food_name),
			ai_calories: num(r.ai_calories),
			ai_protein_g: num(r.ai_protein_g),
			ai_carbs_g: num(r.ai_carbs_g),
			ai_fat_g: num(r.ai_fat_g),
			ai_notes: text(r.ai_notes),
			created_at: iso(r.created_at),
			updated_at: iso(r.updated_at ?? r.created_at),
		}),
	},
	{
		source: "workout_logs",
		target: "workout_logs",
		context: "workout",
		map: (r) => ({
			id: String(r.id),
			log_date: day(r.log_date),
			content: text(r.content),
			weight: num(r.weight),
			ai_session_type: text(r.ai_session_type),
			ai_exercises: r.ai_exercises ? json(r.ai_exercises) : null,
			ai_total_volume: num(r.ai_total_volume),
			ai_muscle_groups: r.ai_muscle_groups ? json(r.ai_muscle_groups) : null,
			ai_notes: text(r.ai_notes),
			created_at: iso(r.created_at),
			updated_at: iso(r.updated_at ?? r.created_at),
		}),
	},
	{
		source: "visits",
		target: "visits",
		context: "visit",
		map: (r) => ({
			id: String(r.id),
			airport_ident: String(r.airport_ident),
			visit_date: day(r.visit_date),
			flight_numbers: json(r.flight_numbers),
			is_layover: r.is_layover ? 1 : 0,
			notes: text(r.notes),
			created_at: iso(r.created_at),
			updated_at: iso(r.updated_at ?? r.created_at),
		}),
	},
	{
		source: "books",
		target: "books",
		map: (r) => ({
			id: String(r.id),
			title: String(r.title),
			author: String(r.author ?? ""),
			isbn: text(r.isbn),
			cover_url: text(r.cover_url),
			description: text(r.description),
			categories: json(r.categories),
			progress: num(r.progress),
			status: String(r.status),
			date_started: day(r.date_started),
			date_completed: day(r.date_completed),
			notes: text(r.notes),
			is_current: r.is_current ? 1 : 0,
			created_at: iso(r.created_at),
			updated_at: iso(r.updated_at ?? r.created_at),
		}),
	},
	{
		source: "recommendations",
		target: "recommendations",
		map: (r) => ({
			id: String(r.id),
			book_name: String(r.book_name),
			book_author: text(r.book_author),
			book_cover_url: text(r.book_cover_url),
			google_books_id: text(r.google_books_id),
			recommender_name: text(r.recommender_name),
			comment: text(r.comment),
			created_at: iso(r.created_at),
		}),
	},
];

// sb://bucket/path -> photo ID, for every stored file of every photo.
const refToPhoto = new Map<string, string>();
for (const d of await all("photo_derivatives"))
	refToPhoto.set(`sb://${d.bucket}/${d.path}`, String(d.photo_id));
for (const a of await all("photo_assets"))
	refToPhoto.set(String(a.original_private_ref), String(a.id));
const libraryIds = new Set(
	(await d1<{ id: string }>("SELECT id FROM photos WHERE state = 'ready'")).map(
		(row) => row.id,
	),
);
const storedLinks = await d1<{
	photo_id: string;
	context: string;
	context_id: string;
	position: number;
}>("SELECT * FROM photo_links WHERE context != 'journal' ORDER BY position");
let problems = 0;
const problem = (message: string) => {
	problems++;
	console.log(`  ! ${message}`);
};

for (const table of tables) {
	const rows = (await all(table.source)).map((row) => ({
		row,
		mapped: table.map(row),
	}));
	console.log(`${table.source}: ${rows.length} rows`);
	for (const { row, mapped } of rows) {
		for (const [column, value] of Object.entries(mapped))
			if (
				value === null &&
				[
					"entry_date",
					"log_date",
					"visit_date",
					"date_started",
					"eaten_at",
				].includes(column)
			)
				problem(`${table.source} ${mapped.id}: missing ${column}`);
	}
	// The photo IDs each entry should link to, in order.
	const entryPhotos = new Map<string, string[]>();
	if (table.context)
		for (const { row, mapped } of rows) {
			const ids: string[] = [];
			for (const ref of Array.isArray(row.photos) ? row.photos : []) {
				const photoId = refToPhoto.get(String(ref));
				if (!photoId)
					problem(`${table.source} ${mapped.id}: unknown photo ${ref}`);
				else if (!libraryIds.has(photoId))
					problem(`${table.source} ${mapped.id}: photo ${photoId} not in D1`);
				else if (!ids.includes(photoId)) ids.push(photoId);
			}
			if (ids.length) entryPhotos.set(String(mapped.id), ids);
		}
	if (mode === "apply" && rows.length) {
		const columns = Object.keys(rows[0].mapped);
		const sql = `INSERT INTO ${table.target} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})
			ON CONFLICT(id) DO UPDATE SET ${columns
				.filter((c) => c !== "id")
				.map((c) => `${c}=excluded.${c}`)
				.join(",")}`;
		// Books: at most one current; clear first so the unique index never trips mid-batch.
		const prelude =
			table.target === "books"
				? [{ sql: "UPDATE books SET is_current = 0", params: [] }]
				: [];
		// Replace this context's links (including the folder-keyed ones) with per-entry links.
		const relink = table.context
			? [
					{
						sql: "DELETE FROM photo_links WHERE context = ?",
						params: [table.context],
					},
					...[...entryPhotos].flatMap(([entryId, ids]) =>
						ids.map((photoId, position) => ({
							sql: "INSERT INTO photo_links(photo_id,context,context_id,position) VALUES (?,?,?,?)",
							params: [photoId, table.context ?? "", entryId, position],
						})),
					),
				]
			: [];
		await d1Batch([
			...prelude,
			...rows.map(({ mapped }) => ({ sql, params: Object.values(mapped) })),
			...relink,
		]);
		const linked = [...entryPhotos.values()].flat().length;
		console.log(
			`  applied ${rows.length}${table.context ? `, ${linked} photo links` : ""}`,
		);
	}
	if (mode === "verify") {
		const stored = await d1<Record<string, unknown>>(
			`SELECT * FROM ${table.target}`,
		);
		const byId = new Map(stored.map((r) => [String(r.id), r]));
		if (stored.length !== rows.length)
			problem(
				`${table.target}: ${stored.length} in D1, ${rows.length} in Supabase`,
			);
		for (const { mapped } of rows) {
			const d1Row = byId.get(String(mapped.id));
			if (!d1Row) {
				problem(`${table.target} ${mapped.id}: missing in D1`);
				continue;
			}
			for (const [column, value] of Object.entries(mapped))
				if ((d1Row[column] ?? null) !== value)
					problem(
						`${table.target} ${mapped.id}.${column}: D1 ${JSON.stringify(d1Row[column])} != ${JSON.stringify(value)}`,
					);
		}
		if (table.context) {
			const actual = new Map<string, string[]>();
			for (const link of storedLinks.filter((l) => l.context === table.context))
				actual.set(link.context_id, [
					...(actual.get(link.context_id) ?? []),
					link.photo_id,
				]);
			for (const id of new Set([...actual.keys(), ...entryPhotos.keys()]))
				if (
					(actual.get(id) ?? []).join() !== (entryPhotos.get(id) ?? []).join()
				)
					problem(`${table.target} ${id}: photo links differ from Supabase`);
		}
		console.log(`  verified ${rows.length}`);
	}
}
console.log(problems ? `${problems} problem(s)` : "No problems");
if (problems && mode === "verify") process.exitCode = 1;
