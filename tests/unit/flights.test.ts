import {
	chronological,
	connects,
	flightCode,
	journeys,
	saveFlightSchema,
} from "@/shared/flights";
import { describe, expect, it } from "vitest";

const leg = (
	date: string,
	from: string,
	to: string,
	departsAt?: string,
	arrivesAt?: string,
) => ({ date, from, to, departsAt, arrivesAt });

describe("connections", () => {
	it("joins legs at the same airport within 24 hours", () => {
		// CCU 15:53 → 01:05 next day is a 9 h overnight connection.
		const into = leg(
			"2023-02-12",
			"VEBD",
			"VECC",
			"2023-02-12T14:30",
			"2023-02-12T15:53",
		);
		const out = leg(
			"2023-02-13",
			"VECC",
			"WMKK",
			"2023-02-13T01:05",
			"2023-02-13T07:25",
		);
		expect(connects(into, out)).toBe(true);
		// BOM 02:24 → 22:20 the day after is a 44 h stay.
		expect(
			connects(
				leg(
					"2025-01-11",
					"EGLL",
					"VABB",
					"2025-01-11T12:02",
					"2025-01-12T02:24",
				),
				leg("2025-01-13", "VABB", "VOBL", "2025-01-13T22:20"),
			),
		).toBe(false);
		// Another airport never connects.
		expect(connects(into, leg("2023-02-12", "VIDP", "WMKK"))).toBe(false);
	});
	it("needs the same day when times are missing", () => {
		expect(
			connects(
				leg("2026-04-21", "CYYZ", "KATL"),
				leg("2026-04-21", "KATL", "KAUS"),
			),
		).toBe(true);
		expect(
			connects(
				leg("2026-04-21", "CYYZ", "KATL"),
				leg("2026-04-22", "KATL", "KAUS"),
			),
		).toBe(false);
	});
	it("orders same-day legs without times and groups them into journeys", () => {
		const second = leg("2024-06-01", "CYYZ", "MRLB");
		const first = leg("2024-06-01", "CYUL", "CYYZ");
		const home = leg("2024-06-11", "MRLB", "CYYZ");
		expect(chronological([second, home, first])).toEqual([first, second, home]);
		expect(journeys([home, second, first])).toEqual([[first, second], [home]]);
	});
});

describe("flight input", () => {
	it("formats codes with IATA when known", () => {
		expect(
			flightCode({
				airlineIata: "AC",
				airlineIcao: "ACA",
				flightNumber: "590",
			}),
		).toBe("AC 590");
		expect(flightCode({ airlineIcao: "AKJ", flightNumber: "1850" })).toBe(
			"AKJ 1850",
		);
	});
	it("normalizes input and can re-parse its own output", () => {
		const parsed = saveFlightSchema.parse({
			date: "2026-06-24",
			airlineIcao: "aca",
			airlineIata: null,
			airlineName: "  ",
			flightNumber: "590",
			from: "kiah",
			to: "cyyz",
			departsAt: null,
			arrivesAt: null,
			aircraft: "",
			registration: "c-gmiw",
			seat: "",
			seatType: null,
			cabin: null,
			notes: "",
			photoIds: [],
		});
		expect(parsed).toMatchObject({
			airlineIcao: "ACA",
			airlineName: null,
			from: "KIAH",
			registration: "C-GMIW",
			seat: null,
		});
		// Next.js parses, then the Worker parses what Next.js sent.
		expect(saveFlightSchema.parse(parsed)).toEqual(parsed);
	});
});
