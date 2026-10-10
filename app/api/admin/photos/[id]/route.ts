import { privateJson, privateRoute } from "@/lib/backend/api";
import { workerJson, workerRequest } from "@/lib/backend/worker";
import { idSchema, photoSchema } from "@/shared/journal";

type Context = { params: Promise<{ id: string }> };
export const runtime = "nodejs";
export function GET(request: Request, context: Context) {
	return privateRoute(request, async () =>
		privateJson(
			photoSchema.parse(
				await workerJson(
					`/v1/photos/${idSchema.parse((await context.params).id)}`,
				),
			),
		),
	);
}
export function DELETE(request: Request, context: Context) {
	return privateRoute(request, async () => {
		await workerRequest(
			`/v1/photos/${idSchema.parse((await context.params).id)}`,
			{ method: "DELETE" },
		);
		return new Response(null, {
			status: 204,
			headers: { "Cache-Control": "no-store" },
		});
	});
}
