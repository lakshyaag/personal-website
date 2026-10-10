import { z } from "zod";
import { dateSchema } from "../../shared/common";
import type { JournalEntry, SaveJournalInput } from "../../shared/journal";
import {
	ApiError,
	type Env,
	type SqlValue,
	assertChanged,
	batchOrConflict,
	decodeCursor,
	encodeCursor,
	hash,
	now,
	statement,
} from "./http";
import { linkedPhotos, replaceLinks } from "./photos";

interface EntryRow {
	id: string;
	entry_date: string;
	content: string;
	version: number;
	created_at: string;
	updated_at: string;
	last_mutation: string;
}

async function entryDtos(env: Env, rows: EntryRow[]): Promise<JournalEntry[]> {
	const photos = await linkedPhotos(
		env,
		"journal",
		rows.map((row) => row.id),
	);
	return rows.map((row) => ({
		id: row.id,
		date: row.entry_date,
		content: row.content,
		version: row.version,
		createdAt: row.created_at,
		updatedAt: row.updated_at,
		photos: photos.get(row.id) ?? [],
	}));
}
export async function getEntry(env: Env, id: string) {
	const row = await statement(
		env,
		"SELECT * FROM journal_entries WHERE id = ?",
		id,
	).first<EntryRow>();
	if (!row) throw new ApiError(404, "NOT_FOUND", "Entry not found");
	return (await entryDtos(env, [row]))[0];
}
export async function listEntries(env: Env, url: URL) {
	const date = url.searchParams.get("date");
	if (date) dateSchema.parse(date);
	const limit = z.coerce
		.number()
		.int()
		.min(1)
		.max(50)
		.parse(url.searchParams.get("limit") ?? 20);
	const cursor = decodeCursor(url.searchParams.get("cursor"), 3);
	const filters: string[] = [];
	const params: SqlValue[] = [];
	if (date) {
		filters.push("entry_date = ?");
		params.push(date);
	}
	if (cursor) {
		filters.push("(entry_date, created_at, id) < (?, ?, ?)");
		params.push(...cursor);
	}
	const { results } = await statement(
		env,
		`SELECT * FROM journal_entries ${filters.length ? `WHERE ${filters.join(" AND ")}` : ""} ORDER BY entry_date DESC, created_at DESC, id DESC LIMIT ?`,
		...params,
		limit + 1,
	).all<EntryRow>();
	const page = results.slice(0, limit);
	const last = page.at(-1);
	return {
		entries: await entryDtos(env, page),
		nextCursor:
			results.length > limit && last
				? encodeCursor([last.entry_date, last.created_at, last.id])
				: null,
	};
}
export async function saveEntry(env: Env, input: SaveJournalInput) {
	const mutation = await hash(JSON.stringify(input));
	const previous = await statement(
		env,
		"SELECT * FROM journal_entries WHERE id = ?",
		input.id,
	).first<EntryRow>();
	if (previous?.last_mutation === mutation)
		return (await entryDtos(env, [previous]))[0];
	if ((previous?.version ?? 0) !== input.expectedVersion)
		throw new ApiError(
			409,
			"CONFLICT",
			"This entry changed. Reload it before saving.",
		);
	const timestamp = now();
	await batchOrConflict(
		env,
		[
			statement(
				env,
				`INSERT INTO journal_entries (id,entry_date,content,version,created_at,updated_at,last_mutation)
				SELECT ?,?,?,1,?,?,? WHERE ? = 0 OR EXISTS(SELECT 1 FROM journal_entries WHERE id = ? AND version = ?)
				ON CONFLICT(id) DO UPDATE SET entry_date=excluded.entry_date,content=excluded.content,
				version=journal_entries.version+1,updated_at=excluded.updated_at,last_mutation=excluded.last_mutation WHERE journal_entries.version = ?`,
				input.id,
				input.date,
				input.content,
				timestamp,
				timestamp,
				mutation,
				input.expectedVersion,
				input.id,
				input.expectedVersion,
				input.expectedVersion,
			),
			...assertChanged(env),
			...(await replaceLinks(env, "journal", input.id, input.photoIds)),
		],
		"Entry changed or photos are not ready. Reload and retry.",
	);
	return getEntry(env, input.id);
}
export async function deleteEntry(env: Env, id: string, version: number) {
	await batchOrConflict(
		env,
		[
			statement(
				env,
				"DELETE FROM journal_entries WHERE id = ? AND version = ?",
				id,
				version,
			),
			...assertChanged(env),
			...(await replaceLinks(env, "journal", id, [])),
		],
		"Entry changed or was already deleted. Reload and retry.",
	);
}
