import { analyzeFood } from "./food";
import { ApiError, type Env } from "./http";
import { analyzeWorkout } from "./workouts";

/** `origin` is the Worker's own URL, which food analysis needs to sign photo links for the model. */
export interface AnalysisJob {
	kind: "food" | "workouts";
	id: string;
	origin: string;
}

/**
 * Saving an entry that needs analysis queues it, so nothing upstream waits on the model.
 * A failed send is logged and leaves the "Analyze" button, as before.
 */
export async function queueAnalysis(env: Env, job: AnalysisJob) {
	try {
		await env.ANALYSIS_QUEUE.send(job);
	} catch {
		console.error(
			JSON.stringify({ code: "ANALYSIS_QUEUE_FAILED", kind: job.kind }),
		);
	}
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
		const { kind, id, origin } = message.body;
		try {
			if (kind === "food") await analyzeFood(env, id, origin);
			else await analyzeWorkout(env, id);
			message.ack();
		} catch (error) {
			const code = error instanceof ApiError ? error.code : "INTERNAL";
			const retry = !(error instanceof ApiError && error.status < 500);
			console.error(
				JSON.stringify({
					code: "ANALYSIS_FAILED",
					kind,
					reason: code,
					attempt: message.attempts,
					retry,
				}),
			);
			if (retry) message.retry({ delaySeconds: 30 });
			else message.ack();
		}
	}
}
