import "server-only";
import { idSchema } from "@/shared/common";

export type IdContext = { params: Promise<{ id: string }> };
export const routeId = async (context: IdContext) =>
	idSchema.parse((await context.params).id);
export const noContent = () =>
	new Response(null, {
		status: 204,
		headers: { "Cache-Control": "private, no-store" },
	});
