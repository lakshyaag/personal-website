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
			<Link
				href="/admin/journal"
				className="block rounded-xl border border-zinc-300 p-6 dark:border-zinc-700"
			>
				<h2 className="text-xl font-medium">Journal</h2>
				<p className="mt-2 text-zinc-500">Entries and photos</p>
			</Link>
		</main>
	);
}
