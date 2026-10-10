import { z } from "zod";
import { ApiError, type Env } from "./http";

const BASE_URL = "https://api.pinference.ai/api/v1";
const DEFAULT_MODEL = "z-ai/glm-5.3-flash";

type Part =
	| { type: "text"; text: string }
	| { type: "image_url"; image_url: { url: string } };

/**
 * One structured-output call to Prime Intellect. Images are passed as short-lived URLs that the
 * provider fetches itself, so the Worker never downloads or encodes them (Workers Free CPU limit).
 * Waiting on the response is wall-clock time, not CPU.
 */
export async function generateJson(
	env: Env,
	{
		name,
		schema,
		text,
		imageUrls = [],
	}: { name: string; schema: z.ZodType; text: string; imageUrls?: string[] },
): Promise<unknown> {
	if (!env.PRIME_API_KEY)
		throw new ApiError(
			503,
			"AI_NOT_CONFIGURED",
			"AI analysis is not configured",
		);
	const content: Part[] = [
		{ type: "text", text },
		...imageUrls.map(
			(url): Part => ({ type: "image_url", image_url: { url } }),
		),
	];
	let response: Response;
	try {
		response = await fetch(`${BASE_URL}/chat/completions`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${env.PRIME_API_KEY}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				model: env.AI_MODEL || DEFAULT_MODEL,
				messages: [{ role: "user", content }],
				response_format: {
					type: "json_schema",
					json_schema: { name, schema: z.toJSONSchema(schema) },
				},
			}),
			signal: AbortSignal.timeout(90_000),
		});
	} catch {
		throw new ApiError(502, "AI_UNAVAILABLE", "AI analysis timed out. Retry.");
	}
	if (!response.ok) {
		console.error(
			JSON.stringify({ code: "AI_FAILED", status: response.status }),
		);
		throw new ApiError(502, "AI_FAILED", "AI analysis failed. Retry.");
	}
	const data = (await response.json()) as {
		choices?: { message?: { content?: string | null } }[];
	};
	const raw = data.choices?.[0]?.message?.content ?? "";
	try {
		// Some models wrap JSON in a code fence despite the schema.
		return JSON.parse(raw.replace(/^```(?:json)?\s*|\s*```$/g, ""));
	} catch {
		throw new ApiError(
			502,
			"AI_FAILED",
			"AI returned an unreadable answer. Retry.",
		);
	}
}

/** Models sometimes answer "500 kcal" or "8-10" instead of a number. */
export function looseNumber(value: unknown): number | null {
	if (typeof value === "number") return Number.isFinite(value) ? value : null;
	if (typeof value !== "string") return null;
	const range = value.match(/(\d+(?:\.\d+)?)\s*-\s*(\d+(?:\.\d+)?)/);
	if (range) return Math.round((Number(range[1]) + Number(range[2])) / 2);
	const match = value.match(/\d+(?:\.\d+)?/);
	return match ? Number(match[0]) : null;
}
