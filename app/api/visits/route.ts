import { randomUUID } from "node:crypto";
import { cloudflareAdmin } from "@/lib/backend/config";
import { publicVisits } from "@/lib/backend/public-data";
import type { Visit } from "@/lib/models";
import {
	deleteVisit,
	getVisits,
	getVisitsByDate,
	getVisitsGroupedByDate,
	saveVisit,
} from "@/lib/visits-db";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
	try {
		const { searchParams } = new URL(req.url);
		const date = searchParams.get("date");
		const grouped = searchParams.get("grouped");
		// The public airports map. The admin page uses /api/admin/visits.
		if (cloudflareAdmin()) return NextResponse.json(await publicVisits());

		// Get by date
		if (date) {
			const visits = await getVisitsByDate(date);
			return NextResponse.json(visits);
		}

		// Get grouped by date
		if (grouped === "true") {
			const groupedVisits = await getVisitsGroupedByDate();
			return NextResponse.json(groupedVisits);
		}

		// Get all
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
			return NextResponse.json({ error: "Missing visit id" }, { status: 400 });
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
