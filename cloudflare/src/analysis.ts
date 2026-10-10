import { analyzeFood, getFood } from "./food";
import { ApiError, type Env, now, statement } from "./http";
import { analyzeWorkout, getWorkout } from "./workouts";

/**
 * `origin` is the Worker's own URL, which food analysis needs to sign photo links for the model.
 * `queuedAt` identifies the job, so finishing it never clears a newer one's flag.
 */
export interface AnalysisJob {
	kind: "food" | "workouts";
	id: string;
	origin: string;
	queuedAt: string;
}
type Kind = AnalysisJob["kind"];

const tables = { food: "food_entries", workouts: "workout_logs" } as const;
/** The first delivery plus `maxRetries: 3` in cloudflare.config.ts. */
const lastAttempt = 4;
/** Longer than every retry; a flag older than this belongs to a lost job. */
const pendingMs = 15 * 60_000;

export const analysisPending = (queuedAt: string | null) =>
	Boolean(queuedAt && Date.now() - Date.parse(queuedAt) < pendingMs);

const fresh = (env: Env, kind: Kind, id: string) =>
	kind === "food" ? getFood(env, id) : getWorkout(env, id);
const finish = (env: Env, { kind, id, queuedAt }: AnalysisJob) =>
	statement(
		env,
		`UPDATE ${tables[kind]} SET analysis_queued_at = NULL WHERE id = ? AND analysis_queued_at = ?`,
		id,
		queuedAt,
	).run();

/** Flags the entry as analyzing and queues the job, so nothing upstream waits on the model. */
export async function queueAnalysis(
	env: Env,
	kind: Kind,
	id: string,
	origin: string,
) {
	const job = { kind, id, origin, queuedAt: now() };
	await statement(
		env,
		`UPDATE ${tables[kind]} SET analysis_queued_at = ? WHERE id = ?`,
		job.queuedAt,
		id,
	).run();
	try {
		await env.ANALYSIS_QUEUE.send(job);
	} catch {
		console.error(JSON.stringify({ code: "ANALYSIS_QUEUE_FAILED", kind }));
		await finish(env, job);
	}
	return fresh(env, kind, id);
}

/** The "Analyze" button: checks what the consumer would refuse, then queues. */
export async function requestAnalysis(
	env: Env,
	kind: Kind,
	id: string,
	origin: string,
) {
	if (!env.PRIME_API_KEY)
		throw new ApiError(
			503,
			"AI_NOT_CONFIGURED",
			"AI analysis is not configured",
		);
	const entry = await fresh(env, kind, id);
	const empty =
		"eatenAt" in entry
			? !entry.description && !entry.photos.length
			: !entry.content;
	if (empty) throw new ApiError(400, "EMPTY", "There is nothing to analyze");
	return queueAnalysis(env, kind, id, origin);
}

/**
 * Model and network failures retry. Client errors don't: the entry is gone or empty, or it
 * changed during analysis, in which case that save queued its own job.
 */
export async function consumeAnalysis(
	batch: MessageBatch<AnalysisJob>,
	env: Env,
) {
	for (const message of batch.messages) {
		const job = message.body;
		try {
			if (job.kind === "food") await analyzeFood(env, job.id, job.origin);
			else await analyzeWorkout(env, job.id);
			await finish(env, job);
			message.ack();
		} catch (error) {
			const code = error instanceof ApiError ? error.code : "INTERNAL";
			const retry =
				!(error instanceof ApiError && error.status < 500) &&
				code !== "AI_NOT_CONFIGURED" &&
				message.attempts < lastAttempt;
			console.error(
				JSON.stringify({
					code: "ANALYSIS_FAILED",
					kind: job.kind,
					reason: code,
					attempt: message.attempts,
					retry,
				}),
			);
			if (retry) message.retry({ delaySeconds: 30 });
			else {
				await finish(env, job);
				message.ack();
			}
		}
	}
}
