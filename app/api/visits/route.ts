import { NextResponse } from "next/server";
import { getVisits, saveVisit, deleteVisit } from "@/lib/visits-db";
import type { Visit } from "@/lib/models";
import { randomUUID } from "node:crypto";

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

		const newVisit: Visit = {
			id: body.id || randomUUID(),
			airportIdent: body.airportIdent,
			date: body.date,
			flightNumbers: body.flightNumbers,
			isLayover: body.isLayover,
			notes: body.notes,
			photos: body.photos,
		};

		const id = await saveVisit(newVisit);

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

		await deleteVisit(id);

		return NextResponse.json({ ok: true });
	} catch (error) {
		console.error("Error in DELETE /api/visits:", error);
		return NextResponse.json(
			{ error: "Failed to delete visit" },
			{ status: 500 },
		);
	}
}
