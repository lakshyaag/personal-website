import "server-only";
import { idSchema } from "@/shared/common";
import { after } from "next/server";
import { workerRequest } from "./worker";

export type IdContext = { params: Promise<{ id: string }> };
export const routeId = async (context: IdContext) =>
	idSchema.parse((await context.params).id);
export const noContent = () =>
	new Response(null, {
		status: 204,
		headers: { "Cache-Control": "private, no-store" },
	});
/** The model can take a while; the Worker waits on it without using CPU. */
export const analysisTimeout = () => AbortSignal.timeout(110_000);
/** Runs analysis after the response, like the old Supabase webhook. A failure leaves the "Analyze" button. */
export function analyzeLater(path: string) {
	after(async () => {
		try {
			await workerRequest(path, { method: "POST", signal: analysisTimeout() });
		} catch (error) {
			console.error(
				JSON.stringify({
					code: "AUTO_ANALYSIS_FAILED",
					path,
					error: String(error),
				}),
			);
		}
	});
}
