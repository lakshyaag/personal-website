export class AdminRequestError extends Error {
	constructor(
		message: string,
		public status: number,
	) {
		super(message);
	}
}
export async function adminRequest<T>(
	path: string,
	init: RequestInit = {},
): Promise<T> {
	const headers = new Headers(init.headers);
	if (typeof init.body === "string")
		headers.set("Content-Type", "application/json");
	const response = await fetch(`/api/admin/${path}`, {
		...init,
		headers,
		cache: "no-store",
		credentials: "same-origin",
	});
	if (!response.ok) {
		const data = (await response.json().catch(() => ({}))) as {
			error?: string;
		};
		throw new AdminRequestError(
			data.error ?? "Request failed. Retry shortly.",
			response.status,
		);
	}
	return response.status === 204 ? (undefined as T) : response.json();
}
