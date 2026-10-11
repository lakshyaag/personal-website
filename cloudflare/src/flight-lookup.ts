import type { FlightLookup } from "../../shared/flights";
import { ApiError, type Env } from "./http";

/**
 * Looks a flight up by number and departure date on AeroDataBox (via RapidAPI). Only the admin's
 * "Look up" button calls this: the plan has a small monthly unit budget, so nothing calls it
 * automatically.
 */
interface Movement {
	airport?: { icao?: string };
	scheduledTime?: { local?: string };
	revisedTime?: { local?: string };
	predictedTime?: { local?: string };
}
interface AeroDataBoxFlight {
	number?: string;
	departure?: Movement;
	arrival?: Movement;
	aircraft?: { reg?: string; model?: string };
	airline?: { name?: string; iata?: string; icao?: string };
}
/**
 * "2024-01-26 15:25+03:00" → "2024-01-26T15:25", the airport's wall clock. Actual (revised) beats
 * scheduled; some flights only have a predicted time (seen on a codeshare's arrival).
 */
const localTime = (movement?: Movement) => {
	const value =
		movement?.revisedTime?.local ??
		movement?.scheduledTime?.local ??
		movement?.predictedTime?.local;
	return value ? `${value.slice(0, 10)}T${value.slice(11, 16)}` : null;
};

export async function lookupFlight(
	env: Env,
	number: string,
	date: string,
): Promise<FlightLookup> {
	if (!env.AERODATABOX_API_KEY)
		throw new ApiError(
			503,
			"NOT_CONFIGURED",
			"Flight lookup is not configured",
		);
	const response = await fetch(
		`https://aerodatabox.p.rapidapi.com/flights/number/${encodeURIComponent(number)}/${date}?dateLocalRole=Departure&withAircraftImage=false&withLocation=false`,
		{
			headers: {
				"X-RapidAPI-Key": env.AERODATABOX_API_KEY,
				"X-RapidAPI-Host": "aerodatabox.p.rapidapi.com",
			},
		},
	);
	if (response.status === 204 || response.status === 404)
		return { candidates: [] };
	if (!response.ok)
		throw new ApiError(
			502,
			"LOOKUP_FAILED",
			response.status === 429
				? "Flight lookup quota or rate limit reached"
				: `Flight lookup failed (${response.status})`,
		);
	const flights = (await response.json()) as AeroDataBoxFlight[];
	return {
		// A multi-leg flight number returns one entry per leg.
		candidates: flights.flatMap((flight) => {
			const from = flight.departure?.airport?.icao;
			const to = flight.arrival?.airport?.icao;
			const departsAt = localTime(flight.departure);
			if (!from || !to) return [];
			return [
				{
					airlineIcao: flight.airline?.icao ?? null,
					airlineIata: flight.airline?.iata ?? null,
					airlineName: flight.airline?.name ?? null,
					flightNumber:
						flight.number?.split(/\s+/).at(-1) ?? number.replace(/^\D+/, ""),
					from,
					to,
					date: departsAt?.slice(0, 10) ?? date,
					departsAt,
					arrivesAt: localTime(flight.arrival),
					aircraft: flight.aircraft?.model ?? null,
					registration: flight.aircraft?.reg ?? null,
				},
			];
		}),
	};
}
