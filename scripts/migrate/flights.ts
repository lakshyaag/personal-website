// One-off: turn airport visits into flights, using a Flighty CSV export for the details.
//   bun scripts/migrate/flights.ts plan|apply|verify <FlightyExport.csv>
// Each visit row is one airport on one day with the flight numbers that touched it. A Flighty
// flight is imported when both of its airports have a visit naming its number within a day of it.
// Flighty-only flights (cancelled, upcoming, never logged) are skipped. Visit notes and photos
// move to the flight that left that airport (else the one that arrived). The PNR is never read.
// Flighty only gives ICAO airline codes; IATA codes and names come from OpenFlights, and gaps are
// reported (fill them in the admin). Idempotent: flights upsert by Flighty ID. `visits` itself is
// left untouched.
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { d1, d1Batch } from "./d1";

const [mode, csvPath] = process.argv.slice(2);
if (!["plan", "apply", "verify"].includes(mode ?? "") || !csvPath)
	throw new Error("Usage: flights.ts plan|apply|verify <FlightyExport.csv>");

/** Flighty codes that are wrong in the export. */
const AIRLINE_FIXES: Record<string, string> = { SLT: "AKJ" };
const CABINS: Record<string, string> = {
	ECONOMY: "economy",
	PREMIUM_ECONOMY: "premium",
	BUSINESS: "business",
	FIRST: "first",
};

function parseCsv(text: string) {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";
	let quoted = false;
	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (quoted) {
			if (c === '"' && text[i + 1] === '"') field += text[++i];
			else if (c === '"') quoted = false;
			else field += c;
		} else if (c === '"') quoted = true;
		else if (c === ",") {
			row.push(field);
			field = "";
		} else if (c === "\n" || c === "\r") {
			if (c === "\r" && text[i + 1] === "\n") i++;
			row.push(field);
			rows.push(row);
			row = [];
			field = "";
		} else field += c;
	}
	if (field || row.length) rows.push([...row, field]);
	const [header, ...body] = rows;
	return body.map((cells) =>
		Object.fromEntries(header.map((name, i) => [name, cells[i] ?? ""])),
	);
}

const airports = JSON.parse(
	readFileSync(
		path.resolve(import.meta.dirname, "../../data/airports.min.json"),
		"utf8",
	),
) as { ident: string; iata_code: string }[];
const icaoByIata = new Map(
	airports.filter((a) => a.iata_code).map((a) => [a.iata_code, a.ident]),
);
const icao = (iata: string) => {
	const ident = icaoByIata.get(iata);
	if (!ident) throw new Error(`Unknown airport ${iata}`);
	return ident;
};
const text = (value: string | undefined) => value?.trim() || null;

/** OpenFlights airlines.dat: id,name,alias,iata,icao,callsign,country,active. Active rows win. */
const airlines = new Map<string, { iata: string | null; name: string }>();
for (const [, name, , iata, code, , , active] of parseCsv(
	`id,name,alias,iata,icao,callsign,country,active\n${await (
		await fetch(
			"https://raw.githubusercontent.com/jpatokal/openflights/master/data/airlines.dat",
		)
	).text()}`,
).map((row) => Object.values(row))) {
	if (!/^[A-Z]{3}$/.test(code) || (airlines.has(code) && active !== "Y"))
		continue;
	airlines.set(code, {
		iata: /^[A-Z0-9]{2}$/.test(iata) ? iata : null,
		name,
	});
}

interface Visit {
	id: string;
	airport_ident: string;
	visit_date: string;
	flight_numbers: string;
	notes: string | null;
}
interface Link {
	photo_id: string;
	context_id: string;
	position: number;
}
const visits = await d1<Visit>(
	"SELECT id, airport_ident, visit_date, flight_numbers, notes FROM visits ORDER BY visit_date, created_at",
);
const visitLinks = await d1<Link>(
	"SELECT photo_id, context_id, position FROM photo_links WHERE context = 'visit' ORDER BY context_id, position",
);
const existing = new Map(
	(
		await d1<{ id: string; flighty_id: string }>(
			"SELECT id, flighty_id FROM flights WHERE flighty_id IS NOT NULL",
		)
	).map((row) => [row.flighty_id, row.id]),
);
/** Flight numbers without the airline: visits mixed "ACA 43" and "AC 590". */
const numbersOf = (visit: Visit) =>
	(JSON.parse(visit.flight_numbers) as string[]).map((f) =>
		f.replace(/^\S+\s*/, ""),
	);
const dayGap = (a: string, b: string) =>
	Math.abs(Date.parse(a.slice(0, 10)) - Date.parse(b.slice(0, 10))) /
	86_400_000;

const flighty = parseCsv(readFileSync(csvPath, "utf8"));
const flights: {
	id: string;
	flighty_id: string;
	flight_date: string;
	airline_icao: string;
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
	seat_type: string | null;
	cabin: string | null;
	origin: Visit;
	destination: Visit;
}[] = [];
const used = new Map<string, number>();
for (const row of flighty) {
	if (row.Canceled === "true") continue;
	const from = icao(row.From);
	const to = icao(row.To);
	const departsAt =
		text(row["Gate Departure (Actual)"]) ??
		text(row["Gate Departure (Scheduled)"]);
	const arrivesAt =
		text(row["Gate Arrival (Actual)"]) ?? text(row["Gate Arrival (Scheduled)"]);
	const at = (airport: string, date: string) =>
		visits.find(
			(v) =>
				v.airport_ident === airport &&
				dayGap(v.visit_date, date) <= 1 &&
				numbersOf(v).includes(row.Flight),
		);
	const origin = at(from, row.Date);
	const destination = at(to, arrivesAt ?? row.Date);
	if (!origin || !destination) continue;
	for (const v of [origin, destination])
		used.set(v.id, (used.get(v.id) ?? 0) + 1);
	const airline = AIRLINE_FIXES[row.Airline] ?? row.Airline;
	flights.push({
		id: existing.get(row["Flight Flighty ID"]) ?? randomUUID(),
		flighty_id: row["Flight Flighty ID"],
		flight_date: row.Date,
		airline_icao: airline,
		airline_iata: airlines.get(airline)?.iata ?? null,
		airline_name: airlines.get(airline)?.name ?? null,
		flight_number: row.Flight,
		from_ident: from,
		to_ident: to,
		departs_at: departsAt,
		arrives_at: arrivesAt,
		aircraft: text(row["Aircraft Type Name"]),
		registration: text(row["Tail Number"]),
		seat: text(row.Seat)?.toUpperCase() ?? null,
		seat_type: text(row["Seat Type"])?.toLowerCase() ?? null,
		cabin: CABINS[row["Cabin Class"]] ?? null,
		origin,
		destination,
	});
}

// Every flight number on every visit should now belong to exactly one imported flight.
const unmatched = visits.filter(
	(v) => (used.get(v.id) ?? 0) !== numbersOf(v).length,
);
/** A visit's notes and photos go to the flight that left from it, else the one that landed there. */
const home = (visit: Visit) =>
	flights.find((f) => f.origin.id === visit.id) ??
	flights.find((f) => f.destination.id === visit.id);
const notes = new Map<string, string[]>();
const links = new Map<string, string[]>();
for (const visit of visits) {
	const flight = home(visit);
	if (!flight) continue;
	if (visit.notes?.trim())
		notes.set(flight.id, [...(notes.get(flight.id) ?? []), visit.notes.trim()]);
	const photos = visitLinks
		.filter((l) => l.context_id === visit.id)
		.map((l) => l.photo_id);
	if (photos.length)
		links.set(flight.id, [...(links.get(flight.id) ?? []), ...photos]);
}

const label = (f: (typeof flights)[number]) =>
	`${f.flight_date} ${`${f.airline_iata ?? f.airline_icao} ${f.flight_number}`.padEnd(9)} ${f.from_ident}->${f.to_ident}`;
if (mode === "plan") {
	for (const f of flights)
		console.log(
			label(f),
			[f.aircraft, f.seat, f.cabin].filter(Boolean).join(" · "),
			links.get(f.id)?.length ? `· ${links.get(f.id)?.length} photos` : "",
			notes.get(f.id) ? `· notes: ${notes.get(f.id)?.join(" / ")}` : "",
		);
	console.log(
		`\n${flights.length} flights from ${flighty.length} Flighty rows; ${visits.length} visits; ${visitLinks.length} visit photos.`,
	);
	console.log(
		"Skipped (not in the visit log):",
		flighty
			.filter(
				(r) => !flights.some((f) => f.flighty_id === r["Flight Flighty ID"]),
			)
			.map(
				(r) =>
					`${r.Date} ${r.Airline}${r.Flight} ${r.From}-${r.To}${r.Canceled === "true" ? " (cancelled)" : ""}`,
			),
	);
	const gaps = [
		...new Set(
			flights
				.filter((f) => !f.airline_iata || !f.airline_name)
				.map((f) => f.airline_icao),
		),
	];
	if (gaps.length)
		console.log("Airlines missing an IATA code or name in OpenFlights:", gaps);
	if (unmatched.length) console.log("UNMATCHED VISITS:", unmatched);
} else if (mode === "apply") {
	if (unmatched.length)
		throw new Error(
			`${unmatched.length} visits don't match a flight; run plan`,
		);
	const now = new Date().toISOString();
	const statements: { sql: string; params: (string | number | null)[] }[] = [];
	for (const f of flights) {
		statements.push({
			sql: `INSERT INTO flights (id,flight_date,airline_icao,airline_iata,airline_name,flight_number,from_ident,
				to_ident,departs_at,arrives_at,aircraft,registration,seat,seat_type,cabin,notes,flighty_id,created_at,updated_at)
				VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(flighty_id) DO UPDATE SET
				flight_date=excluded.flight_date,airline_icao=excluded.airline_icao,
				airline_iata=COALESCE(flights.airline_iata, excluded.airline_iata),
				airline_name=COALESCE(flights.airline_name, excluded.airline_name),flight_number=excluded.flight_number,
				from_ident=excluded.from_ident,to_ident=excluded.to_ident,departs_at=excluded.departs_at,
				arrives_at=excluded.arrives_at,aircraft=excluded.aircraft,
				registration=COALESCE(flights.registration, excluded.registration),seat=excluded.seat,
				seat_type=excluded.seat_type,cabin=excluded.cabin,
				notes=COALESCE(flights.notes, excluded.notes),updated_at=excluded.updated_at`,
			params: [
				f.id,
				f.flight_date,
				f.airline_icao,
				f.airline_iata,
				f.airline_name,
				f.flight_number,
				f.from_ident,
				f.to_ident,
				f.departs_at,
				f.arrives_at,
				f.aircraft,
				f.registration,
				f.seat,
				f.seat_type,
				f.cabin,
				notes.get(f.id)?.join("\n\n") ?? null,
				f.flighty_id,
				now,
				now,
			],
		});
	}
	// Photo links move from visits to flights, renumbered since two visits can share a flight.
	for (const [flightId, photoIds] of links)
		photoIds.forEach((photoId, position) =>
			statements.push({
				sql: "INSERT INTO photo_links (photo_id, context, context_id, position) VALUES (?, 'flight', ?, ?)",
				params: [photoId, flightId, position],
			}),
		);
	statements.push({
		sql: "DELETE FROM photo_links WHERE context = 'visit'",
		params: [],
	});
	// Same rule as syncVisibility in cloudflare/src/photos.ts.
	const publicByUse = `featured = 1 OR (map_hidden = 0 AND EXISTS(
		SELECT 1 FROM photo_links WHERE photo_id = photos.id AND context = 'flight'))`;
	statements.push({
		sql: `UPDATE photos SET visibility = CASE WHEN ${publicByUse} THEN 'public' ELSE 'private' END`,
		params: [],
	});
	await d1Batch(statements);
	console.log(
		`Upserted ${flights.length} flights and moved ${visitLinks.length} photo links.`,
	);
} else {
	const rows = await d1<{
		id: string;
		flighty_id: string;
		from_ident: string;
		to_ident: string;
		flight_date: string;
	}>("SELECT id, flighty_id, from_ident, to_ident, flight_date FROM flights");
	const problems: string[] = [];
	for (const f of flights) {
		const row = rows.find((r) => r.flighty_id === f.flighty_id);
		if (!row) problems.push(`missing ${label(f)}`);
		else if (
			row.from_ident !== f.from_ident ||
			row.to_ident !== f.to_ident ||
			row.flight_date !== f.flight_date
		)
			problems.push(`differs ${label(f)}`);
	}
	const flightLinks = await d1<{
		photo_id: string;
		visibility: string;
		map_hidden: number;
	}>(
		"SELECT l.photo_id, p.visibility, p.map_hidden FROM photo_links l JOIN photos p ON p.id = l.photo_id WHERE l.context = 'flight'",
	);
	const leftover = await d1<{ n: number }>(
		"SELECT COUNT(*) AS n FROM photo_links WHERE context = 'visit'",
	);
	if (leftover[0].n)
		problems.push(`${leftover[0].n} photo links still on visits`);
	for (const link of flightLinks)
		if (link.visibility !== (link.map_hidden ? "private" : "public"))
			problems.push(`photo ${link.photo_id} is ${link.visibility}`);
	console.log(
		`${rows.length} flights in D1, ${flights.length} expected; ${flightLinks.length} flight photo links.`,
	);
	if (problems.length) {
		console.log(problems.join("\n"));
		process.exitCode = 1;
	} else console.log("OK");
}
