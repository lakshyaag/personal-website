export function cloudflareAdmin() {
	return process.env.ADMIN_BACKEND === "cloudflare";
}
export function validSecret(value: string | undefined) {
	return Boolean(
		value && value.length >= 32 && !/REPLACE|CHANGEME|placeholder/i.test(value),
	);
}
export function ownerAllowed(
	id: unknown,
	configuredId = process.env.ADMIN_GITHUB_ID,
) {
	return (
		typeof configuredId === "string" &&
		/^\d+$/.test(configuredId) &&
		String(id) === configuredId
	);
}
export function safeRedirect(value: string | undefined | null) {
	if (
		!value ||
		!value.startsWith("/admin") ||
		value.startsWith("//") ||
		value.includes("\\")
	)
		return "/admin/journal";
	try {
		const url = new URL(value, "https://local.invalid");
		if (
			url.origin !== "https://local.invalid" ||
			!(url.pathname === "/admin" || url.pathname.startsWith("/admin/")) ||
			url.pathname.startsWith("/admin/login")
		)
			return "/admin/journal";
		return url.pathname + url.search;
	} catch {
		return "/admin/journal";
	}
}
export function authConfigured() {
	return (
		validSecret(process.env.AUTH_SECRET) &&
		/^\d+$/.test(process.env.ADMIN_GITHUB_ID ?? "") &&
		Boolean(
			process.env.AUTH_GITHUB_ID &&
				process.env.AUTH_GITHUB_SECRET &&
				!`${process.env.AUTH_GITHUB_ID}${process.env.AUTH_GITHUB_SECRET}`.includes(
					"REPLACE",
				),
		)
	);
}
export function localWorkerUploads() {
	if (
		process.env.NODE_ENV !== "development" ||
		process.env.LOCAL_WORKER_UPLOADS !== "true"
	)
		return false;
	try {
		const url = new URL(process.env.CLOUDFLARE_WORKER_URL ?? "");
		return (
			url.protocol === "http:" &&
			["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)
		);
	} catch {
		return false;
	}
}
