import { privateJson, privateRoute } from "@/lib/backend/api";
import { workerJson, workerRequest } from "@/lib/backend/worker";
import { idSchema } from "@/shared/common";
import { entrySchema } from "@/shared/journal";
import { z } from "zod";

type Context = { params: Promise<{ id: string }> };
export const runtime = "nodejs";
export function GET(request: Request, context: Context) {
	return privateRoute(request, async () => {
		const id = idSchema.parse((await context.params).id);
		return privateJson(
			entrySchema.parse(await workerJson(`/v1/journal/${id}`)),
		);
	});
}
export function DELETE(request: Request, context: Context) {
	return privateRoute(request, async () => {
		const id = idSchema.parse((await context.params).id);
		const version = z.coerce
			.number()
			.int()
			.positive()
			.parse(new URL(request.url).searchParams.get("expectedVersion"));
		await workerRequest(`/v1/journal/${id}?expectedVersion=${version}`, {
			method: "DELETE",
		});
		return new Response(null, {
			status: 204,
			headers: { "Cache-Control": "private, no-store" },
		});
	});
}
