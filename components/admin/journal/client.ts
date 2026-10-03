export class JournalRequestError extends Error {
	constructor(
		message: string,
		public status: number,
	) {
		super(message);
	}
}
export async function journalRequest<T>(
	path: string,
	init: RequestInit = {},
): Promise<T> {
	const headers = new Headers(init.headers);
	if (typeof init.body === "string")
		headers.set("Content-Type", "application/json");
	const response = await fetch(`/api/migration/${path}`, {
		...init,
		headers,
		cache: "no-store",
		credentials: "same-origin",
	});
	if (!response.ok) {
		const data = (await response.json().catch(() => ({}))) as {
			error?: string;
		};
		throw new JournalRequestError(
			data.error ?? "Request failed. Retry shortly.",
			response.status,
		);
	}
	return response.status === 204 ? (undefined as T) : response.json();
}
