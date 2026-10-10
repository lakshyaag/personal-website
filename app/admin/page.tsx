import { signOut } from "@/auth";
import SupabaseDashboard from "@/components/admin/legacy/SupabaseDashboard";
import { requireOwner } from "@/lib/backend/api";
import { cloudflareAdmin } from "@/lib/backend/config";
import Link from "next/link";

export const dynamic = "force-dynamic";
export default async function AdminPage() {
	if (!cloudflareAdmin()) return <SupabaseDashboard />;
	await requireOwner();
	async function logout() {
		"use server";
		await signOut({ redirectTo: "/admin/login" });
	}
	return (
		<main className="space-y-8 pb-16">
			<div className="flex items-center justify-between">
				<h1 className="text-3xl font-medium">Admin</h1>
				<form action={logout}>
					<button type="submit" className="rounded-lg border px-4 py-2">
						Sign out
					</button>
				</form>
			</div>
			<nav className="grid gap-4 sm:grid-cols-2">
				{[
					["/admin/journal", "Journal", "Entries and photos"],
					["/admin/photos", "Photos", "Library and public gallery"],
				].map(([href, title, description]) => (
					<Link
						key={href}
						href={href}
						className="block rounded-xl border border-zinc-300 p-6 dark:border-zinc-700"
					>
						<h2 className="text-xl font-medium">{title}</h2>
						<p className="mt-2 text-zinc-500">{description}</p>
					</Link>
				))}
			</nav>
		</main>
	);
}
