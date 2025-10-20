import { put } from "@vercel/blob";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
	try {
		const form = await req.formData();
		const file = form.get("file") as File | null;
		const airportIdent =
			(form.get("airportIdent") as string) || "misc";

		if (!file) {
			return NextResponse.json(
				{ error: "No file provided" },
				{ status: 400 },
			);
		}

		const filename = `${airportIdent}/${Date.now()}-${file.name}`;
		const { url } = await put(`airports/photos/${filename}`, file, {
			access: "public",
			contentType: file.type,
		});

		return NextResponse.json({ url });
	} catch (error) {
		console.error("Error in POST /api/upload:", error);
		return NextResponse.json(
			{ error: "Failed to upload file" },
			{ status: 500 },
		);
	}
}
