import { z } from "zod";
import { dateSchema, idSchema } from "./common";
import { photoIdsSchema, photoSchema } from "./photos";

export const seatTypes = ["window", "middle", "aisle"] as const;
export const cabins = ["economy", "premium", "business", "first"] as const;
/** Local wall-clock time at the airport, no zone: "2026-06-06T23:15". */
const localTimeSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);

export const flightSchema = z.object({
	id: idSchema,
	date: dateSchema,
	airlineIcao: z.string().optional(),
	airlineIata: z.string().optional(),
	airlineName: z.string().optional(),
	flightNumber: z.string(),
	from: z.string(),
	to: z.string(),
	departsAt: localTimeSchema.optional(),
	arrivesAt: localTimeSchema.optional(),
	aircraft: z.string().optional(),
	registration: z.string().optional(),
	seat: z.string().optional(),
	seatType: z.enum(seatTypes).optional(),
	cabin: z.enum(cabins).optional(),
	notes: z.string().optional(),
	photos: z.array(photoSchema),
	createdAt: z.iso.datetime(),
	updatedAt: z.iso.datetime(),
});
export type Flight = z.infer<typeof flightSchema>;
export const flightListSchema = z.object({ flights: z.array(flightSchema) });

const ident = z
	.string()
	.trim()
	.min(1)
	.max(16)
	.regex(/^[A-Za-z0-9-]+$/)
	.transform((value) => value.toUpperCase());
// Nullable so the Worker can re-parse what Next.js already parsed.
const optionalText = (max: number) =>
	z
		.string()
		.trim()
		.max(max)
		.nullable()
		.transform((value) => value || null);
const code = (pattern: RegExp) =>
	z
		.string()
		.trim()
		.regex(pattern)
		.transform((value) => value.toUpperCase())
		.nullable();
export const saveFlightSchema = z
	.object({
		date: dateSchema,
		airlineIcao: code(/^[A-Za-z]{3}$/),
		airlineIata: code(/^[A-Za-z0-9]{2}$/),
		airlineName: optionalText(100),
		flightNumber: z
			.string()
			.trim()
			.regex(/^\d{1,4}[A-Za-z]?$/)
			.transform((value) => value.toUpperCase()),
		from: ident,
		to: ident,
		departsAt: localTimeSchema.nullable(),
		arrivesAt: localTimeSchema.nullable(),
		aircraft: optionalText(100),
		registration: optionalText(20).transform(
			(value) => value?.toUpperCase() ?? null,
		),
		seat: optionalText(5).transform((value) => value?.toUpperCase() ?? null),
		seatType: z.enum(seatTypes).nullable(),
		cabin: z.enum(cabins).nullable(),
		notes: optionalText(10_000),
		photoIds: photoIdsSchema,
	})
	.strict()
	.refine((flight) => flight.from !== flight.to, {
		message: "A flight needs two different airports",
		path: ["to"],
	})
	.refine((flight) => flight.airlineIcao || flight.airlineIata, {
		message: "An airline code is required",
		path: ["airlineIata"],
	});
export type SaveFlightInput = z.infer<typeof saveFlightSchema>;

/** "AC 590": IATA when known, which is how boarding passes and screens show it. */
export const flightCode = (
	flight: Pick<Flight, "airlineIata" | "airlineIcao" | "flightNumber">,
) => `${flight.airlineIata ?? flight.airlineIcao ?? ""} ${flight.flightNumber}`;

/** What a lookup by flight number and date found; the admin form copies it into the flight. */
export const flightLookupSchema = z.object({
	candidates: z.array(
		z.object({
			airlineIcao: z.string().nullable(),
			airlineIata: z.string().nullable(),
			airlineName: z.string().nullable(),
			flightNumber: z.string(),
			from: z.string(),
			to: z.string(),
			date: dateSchema,
			departsAt: localTimeSchema.nullable(),
			arrivesAt: localTimeSchema.nullable(),
			aircraft: z.string().nullable(),
			registration: z.string().nullable(),
		}),
	),
});
export type FlightLookup = z.infer<typeof flightLookupSchema>;
export const flightLookupQuerySchema = z.object({
	number: z
		.string()
		.trim()
		.regex(/^[A-Za-z0-9]{2,3}\s*\d{1,4}[A-Za-z]?$/)
		.transform((value) => value.replace(/\s+/g, "").toUpperCase()),
	date: dateSchema,
});

type Leg = Pick<Flight, "date" | "from" | "to" | "departsAt" | "arrivesAt">;
const DAY_MS = 24 * 60 * 60 * 1000;
/**
 * Whether `next` continues the trip `previous` arrived on: same airport, leaving within 24 hours.
 * Both times are local to that airport, so they compare directly. Without times, only a same-day
 * departure counts.
 */
export function connects(previous: Leg, next: Leg) {
	if (previous.to !== next.from) return false;
	if (previous.arrivesAt && next.departsAt) {
		const gap =
			Date.parse(`${next.departsAt}Z`) - Date.parse(`${previous.arrivesAt}Z`);
		return gap >= 0 && gap < DAY_MS;
	}
	return (previous.arrivesAt?.slice(0, 10) ?? previous.date) === next.date;
}
/** Earliest first. Times order a day's flights; without them, a leg goes before the one it feeds. */
export function chronological<T extends Leg>(flights: T[]) {
	return [...flights].sort(
		(a, b) =>
			a.date.localeCompare(b.date) ||
			(a.departsAt && b.departsAt
				? a.departsAt.localeCompare(b.departsAt)
				: a.to === b.from
					? -1
					: b.to === a.from
						? 1
						: 0),
	);
}
/** Consecutive flights joined by connections, e.g. YUL → YYZ → LIR. Earliest first. */
export function journeys<T extends Leg>(flights: T[]) {
	const result: T[][] = [];
	for (const flight of chronological(flights)) {
		const current = result.at(-1);
		const last = current?.at(-1);
		if (current && last && connects(last, flight)) current.push(flight);
		else result.push([flight]);
	}
	return result;
}
