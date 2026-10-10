import type { SaveVisitInput, Visit } from "../../shared/visits";
import {
	ApiError,
	type Env,
	batchOrConflict,
	jsonColumn,
	now,
	optional,
	statement,
} from "./http";
import { linkedPhotos, replaceLinks } from "./photos";

interface VisitRow {
	id: string;
	airport_ident: string;
	visit_date: string;
	flight_numbers: string;
	is_layover: number;
	notes: string | null;
	created_at: string;
	updated_at: string;
}

async function visitDtos(env: Env, rows: VisitRow[]): Promise<Visit[]> {
	const photos = await linkedPhotos(
		env,
		"visit",
		rows.map((row) => row.id),
	);
	return rows.map((row) => ({
		id: row.id,
		airportIdent: row.airport_ident,
		date: row.visit_date,
		flightNumbers: jsonColumn<string[]>(row.flight_numbers, []),
		isLayover: row.is_layover === 1,
		notes: optional(row.notes),
		photos: photos.get(row.id) ?? [],
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}));
}
async function visitRow(env: Env, id: string) {
	return statement(
		env,
		"SELECT * FROM visits WHERE id = ?",
		id,
	).first<VisitRow>();
}
export async function getVisit(env: Env, id: string) {
	const row = await visitRow(env, id);
	if (!row) throw new ApiError(404, "NOT_FOUND", "Visit not found");
	return (await visitDtos(env, [row]))[0];
}
export async function listVisits(env: Env) {
	const { results } = await statement(
		env,
		"SELECT * FROM visits ORDER BY visit_date DESC, created_at DESC, id",
	).all<VisitRow>();
	return { visits: await visitDtos(env, results) };
}
export async function saveVisit(env: Env, id: string, input: SaveVisitInput) {
	const timestamp = now();
	await batchOrConflict(
		env,
		[
			statement(
				env,
				`INSERT INTO visits (id,airport_ident,visit_date,flight_numbers,is_layover,notes,created_at,updated_at)
				VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET airport_ident=excluded.airport_ident,
				visit_date=excluded.visit_date,flight_numbers=excluded.flight_numbers,is_layover=excluded.is_layover,
				notes=excluded.notes,updated_at=excluded.updated_at`,
				id,
				input.airportIdent.toUpperCase(),
				input.date,
				JSON.stringify(input.flightNumbers),
				Number(input.isLayover),
				input.notes || null,
				timestamp,
				timestamp,
			),
			...(await replaceLinks(env, "visit", id, input.photoIds)),
		],
		"Photos are not ready. Wait for uploads and retry.",
	);
	return getVisit(env, id);
}
export async function deleteVisit(env: Env, id: string) {
	if (!(await visitRow(env, id)))
		throw new ApiError(404, "NOT_FOUND", "Visit not found");
	await batchOrConflict(
		env,
		[
			statement(env, "DELETE FROM visits WHERE id = ?", id),
			...(await replaceLinks(env, "visit", id, [])),
		],
		"Visit changed. Reload and retry.",
	);
}
