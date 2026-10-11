import type { Flight, SaveFlightInput } from "../../shared/flights";
import {
	ApiError,
	type Env,
	batchOrConflict,
	now,
	optional,
	statement,
} from "./http";
import { linkedPhotos, replaceLinks } from "./photos";

interface FlightRow {
	id: string;
	flight_date: string;
	airline_icao: string | null;
	airline_iata: string | null;
	airline_name: string | null;
	flight_number: string;
	from_ident: string;
	to_ident: string;
	departs_at: string | null;
	arrives_at: string | null;
	aircraft: string | null;
	registration: string | null;
	seat: string | null;
	seat_type: Flight["seatType"] | null;
	cabin: Flight["cabin"] | null;
	notes: string | null;
	created_at: string;
	updated_at: string;
}

async function flightDtos(env: Env, rows: FlightRow[]): Promise<Flight[]> {
	const photos = await linkedPhotos(
		env,
		"flight",
		rows.map((row) => row.id),
	);
	return rows.map((row) => ({
		id: row.id,
		date: row.flight_date,
		airlineIcao: optional(row.airline_icao),
		airlineIata: optional(row.airline_iata),
		airlineName: optional(row.airline_name),
		flightNumber: row.flight_number,
		from: row.from_ident,
		to: row.to_ident,
		departsAt: optional(row.departs_at),
		arrivesAt: optional(row.arrives_at),
		aircraft: optional(row.aircraft),
		registration: optional(row.registration),
		seat: optional(row.seat),
		seatType: optional(row.seat_type),
		cabin: optional(row.cabin),
		notes: optional(row.notes),
		photos: photos.get(row.id) ?? [],
		createdAt: row.created_at,
		updatedAt: row.updated_at,
	}));
}
async function flightRow(env: Env, id: string) {
	return statement(
		env,
		"SELECT * FROM flights WHERE id = ?",
		id,
	).first<FlightRow>();
}
export async function getFlight(env: Env, id: string) {
	const row = await flightRow(env, id);
	if (!row) throw new ApiError(404, "NOT_FOUND", "Flight not found");
	return (await flightDtos(env, [row]))[0];
}
export async function listFlights(env: Env) {
	const { results } = await statement(
		env,
		"SELECT * FROM flights ORDER BY flight_date DESC, departs_at DESC, created_at DESC, id",
	).all<FlightRow>();
	return { flights: await flightDtos(env, results) };
}
export async function saveFlight(env: Env, id: string, input: SaveFlightInput) {
	const timestamp = now();
	await batchOrConflict(
		env,
		[
			statement(
				env,
				`INSERT INTO flights (id,flight_date,airline_icao,airline_iata,airline_name,flight_number,from_ident,to_ident,departs_at,arrives_at,
				aircraft,registration,seat,seat_type,cabin,notes,created_at,updated_at)
				VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET flight_date=excluded.flight_date,
				airline_icao=excluded.airline_icao,airline_iata=excluded.airline_iata,airline_name=excluded.airline_name,flight_number=excluded.flight_number,from_ident=excluded.from_ident,
				to_ident=excluded.to_ident,departs_at=excluded.departs_at,arrives_at=excluded.arrives_at,
				aircraft=excluded.aircraft,registration=excluded.registration,seat=excluded.seat,
				seat_type=excluded.seat_type,cabin=excluded.cabin,notes=excluded.notes,updated_at=excluded.updated_at`,
				id,
				input.date,
				input.airlineIcao,
				input.airlineIata,
				input.airlineName,
				input.flightNumber,
				input.from,
				input.to,
				input.departsAt,
				input.arrivesAt,
				input.aircraft,
				input.registration,
				input.seat,
				input.seatType,
				input.cabin,
				input.notes,
				timestamp,
				timestamp,
			),
			...(await replaceLinks(env, "flight", id, input.photoIds)),
		],
		"Photos are not ready. Wait for uploads and retry.",
	);
	return getFlight(env, id);
}
export async function deleteFlight(env: Env, id: string) {
	if (!(await flightRow(env, id)))
		throw new ApiError(404, "NOT_FOUND", "Flight not found");
	await batchOrConflict(
		env,
		[
			statement(env, "DELETE FROM flights WHERE id = ?", id),
			...(await replaceLinks(env, "flight", id, [])),
		],
		"Flight changed. Reload and retry.",
	);
}
