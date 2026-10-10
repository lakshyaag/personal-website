export interface Env {
	DB: D1Database;
	PHOTOS: R2Bucket;
	WORKER_API_SECRET: string;
	LOCAL_UPLOADS?: string;
	PRIME_API_KEY?: string;
	AI_MODEL?: string;
}
export class ApiError extends Error {
	constructor(
		public status: number,
		public code: string,
		message: string,
	) {
		super(message);
	}
}
export type SqlValue = string | number | null;
export const now = () => new Date().toISOString();
export const statement = (env: Env, sql: string, ...values: SqlValue[]) =>
	env.DB.prepare(sql).bind(...values);
export const responseJson = (data: unknown, status = 200) =>
	Response.json(data, { status });
/** DTOs omit empty columns rather than sending null. */
export const optional = <T>(value: T | null) => value ?? undefined;
export function jsonColumn<T>(value: string | null, fallback: T): T {
	if (!value) return fallback;
	try {
		return JSON.parse(value) as T;
	} catch {
		return fallback;
	}
}

export async function hash(value: string) {
	return Array.from(
		new Uint8Array(
			await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)),
		),
	)
		.map((v) => v.toString(16).padStart(2, "0"))
		.join("");
}
export async function authorized(request: Request, env: Env) {
	const secret = env.WORKER_API_SECRET;
	if (
		!secret ||
		secret.length < 32 ||
		/REPLACE|CHANGEME|placeholder/i.test(secret)
	)
		return false;
	// Fixed-length digests prevent length leaks; no early exit in the comparison.
	const [a, b] = await Promise.all([
		hash(request.headers.get("authorization") ?? ""),
		hash(`Bearer ${secret}`),
	]);
	let diff = 0;
	for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
	return diff === 0;
}
export async function jsonBody(request: Request) {
	if (!request.headers.get("content-type")?.startsWith("application/json"))
		throw new ApiError(415, "CONTENT_TYPE", "Use application/json");
	if (!request.body)
		throw new ApiError(400, "INVALID_JSON", "Missing JSON body");
	const reader = request.body.getReader();
	const chunks: Uint8Array[] = [];
	let size = 0;
	while (true) {
		const { done, value } = await reader.read();
		if (done) break;
		size += value.length;
		if (size > 512_000) {
			await reader.cancel();
			throw new ApiError(413, "BODY_TOO_LARGE", "Request is too large");
		}
		chunks.push(value);
	}
	const buffer = new Uint8Array(size);
	let offset = 0;
	for (const chunk of chunks) {
		buffer.set(chunk, offset);
		offset += chunk.length;
	}
	try {
		return JSON.parse(new TextDecoder().decode(buffer));
	} catch {
		throw new ApiError(400, "INVALID_JSON", "Invalid JSON");
	}
}
/** Runs a D1 batch, turning constraint failures (from write_assertions etc.) into a 409. */
export async function batchOrConflict(
	env: Env,
	statements: D1PreparedStatement[],
	message: string,
) {
	try {
		await env.DB.batch(statements);
	} catch (error) {
		// Don't convert operational database failures into conflicts.
		if (
			String(error).includes("CHECK constraint failed") ||
			String(error).includes("UNIQUE constraint failed")
		)
			throw new ApiError(409, "CONFLICT", message);
		throw error;
	}
}
/** Fails the surrounding batch unless the previous statement changed a row. */
export function assertChanged(env: Env) {
	const id = crypto.randomUUID();
	return [
		statement(
			env,
			"INSERT INTO write_assertions(id,ok) VALUES (?,changes())",
			id,
		),
		statement(env, "DELETE FROM write_assertions WHERE id = ?", id),
	];
}
const cursorSchemaVersion = 1;
export function encodeCursor(values: SqlValue[]) {
	return btoa(JSON.stringify([cursorSchemaVersion, ...values]));
}
export function decodeCursor(value: string | null, length: number) {
	if (value === null) return undefined;
	try {
		const parsed = JSON.parse(atob(value));
		if (
			Array.isArray(parsed) &&
			parsed[0] === cursorSchemaVersion &&
			parsed.length === length + 1 &&
			parsed.slice(1).every((item) => typeof item === "string")
		)
			return parsed.slice(1) as string[];
	} catch {}
	throw new ApiError(400, "INVALID_CURSOR", "Invalid pagination cursor");
}
