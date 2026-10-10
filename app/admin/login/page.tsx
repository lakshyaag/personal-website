import { signIn } from "@/auth";
import { authConfigured, safeRedirect } from "@/lib/backend/config";

export const dynamic = "force-dynamic";
export default async function AdminLogin({
	searchParams,
}: { searchParams: Promise<{ redirectTo?: string; error?: string }> }) {
	const params = await searchParams;
	const ready = authConfigured();
	const redirectTo = safeRedirect(params.redirectTo);
	async function login() {
		"use server";
		if (!authConfigured()) throw new Error("GitHub sign-in is not configured");
		await signIn("github", { redirectTo });
	}
	return (
		<main className="mx-auto max-w-md space-y-6 px-4 py-16">
			<h1 className="text-3xl font-medium">Sign in to admin</h1>
			<p className="text-zinc-600 dark:text-zinc-400">
				Only your approved GitHub account can access the admin application.
			</p>
			{params.error && (
				<p
					role="alert"
					className="rounded-lg border border-red-300 p-4 text-red-700 dark:text-red-300"
				>
					{params.error === "AccessDenied"
						? "This GitHub account is not approved. ADMIN_GITHUB_ID must match the account you use in your browser, not necessarily the account used by the GitHub CLI."
						: "Sign-in failed. Check your GitHub account and OAuth configuration."}
				</p>
			)}
			{!ready && (
				<output className="block rounded-lg border border-amber-300 p-4">
					Add the GitHub OAuth keys, your numeric GitHub user ID, and
					AUTH_SECRET. Setup steps are in{" "}
					<code>docs/cloudflare-backend.md</code>.
				</output>
			)}
			<form action={login}>
				<button
					type="submit"
					disabled={!ready}
					className="w-full rounded-lg bg-zinc-900 px-4 py-3 font-medium text-white disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900"
				>
					Continue with GitHub
				</button>
			</form>
		</main>
	);
}
