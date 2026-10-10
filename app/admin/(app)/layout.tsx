import { signOut } from "@/auth";
import { AdminShell } from "@/components/admin/AdminShell";
import { requireOwner } from "@/lib/backend/api";
import type { Metadata, Viewport } from "next";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Admin", robots: { index: false } };
// Lets the tab bar sit above the iPhone home indicator.
export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	viewportFit: "cover",
};

export default async function AdminLayout({
	children,
}: { children: React.ReactNode }) {
	await requireOwner();
	async function logout() {
		"use server";
		await signOut({ redirectTo: "/admin/login" });
	}
	return <AdminShell signOut={logout}>{children}</AdminShell>;
}
