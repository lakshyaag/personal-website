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
/**
 * For the "Analyze" button only; saves queue analysis in the Worker. Stays under the
 * 60 s Vercel Hobby function limit so a slow model fails cleanly.
 */
export const analysisTimeout = () => AbortSignal.timeout(55_000);
