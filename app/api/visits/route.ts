import { NextResponse } from "next/server";
import { getVisits, saveVisits } from "@/lib/visits-storage";
import type { Visit } from "@/lib/airports";

export async function GET() {
	try {
		const visits = await getVisits();
		return NextResponse.json(visits);
	} catch (error) {
		console.error("Error in GET /api/visits:", error);
		return NextResponse.json(
			{ error: "Failed to fetch visits" },
			{ status: 500 },
		);
	}
}

export async function POST(req: Request) {
	try {
		const body = (await req.json()) as Omit<Visit, "id"> & { id?: string };

		const visits = await getVisits();
		const id =
			body.id ?? `${body.airportIdent}-${body.date}-${Date.now()}`;
		const newVisit: Visit = {
			id,
			airportIdent: body.airportIdent,
			date: body.date,
			flightNumber: body.flightNumber,
			notes: body.notes,
			photos: body.photos,
		};

		const existingIndex = visits.findIndex((v) => v.id === id);
		if (existingIndex >= 0) {
			visits[existingIndex] = newVisit;
		} else {
			visits.push(newVisit);
		}

		await saveVisits(visits);

		return NextResponse.json({ ok: true, id });
	} catch (error) {
		console.error("Error in POST /api/visits:", error);
		return NextResponse.json(
			{ error: "Failed to save visit" },
			{ status: 500 },
		);
	}
}

export async function DELETE(req: Request) {
	try {
		const { searchParams } = new URL(req.url);
		const id = searchParams.get("id");

		if (!id) {
			return NextResponse.json(
				{ error: "Missing visit id" },
				{ status: 400 },
			);
		}

		const visits = await getVisits();
		const filtered = visits.filter((v) => v.id !== id);

		await saveVisits(filtered);

		return NextResponse.json({ ok: true });
	} catch (error) {
		console.error("Error in DELETE /api/visits:", error);
		return NextResponse.json(
			{ error: "Failed to delete visit" },
			{ status: 500 },
		);
	}
}
