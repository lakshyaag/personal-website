"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

type AdminBackButtonProps = {
	label?: string;
	className?: string;
};

export function AdminBackButton({
	label = "Back to Admin",
	className,
}: AdminBackButtonProps) {
	const pathname = usePathname();
	const isAdminRoute = pathname?.startsWith("/admin");
	const isRoot =
		pathname === "/admin" || pathname === "/admin/" || pathname?.startsWith("/admin/login");

	if (!isAdminRoute || isRoot) return null;

	return (
		<Link
			href="/admin"
			aria-label="Back to admin home"
			className={cn(
				"inline-flex w-fit items-center gap-2 rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 dark:border-zinc-700 dark:bg-zinc-900/70 dark:text-zinc-100 dark:hover:border-zinc-500",
				className,
			)}
		>
			<span
				aria-hidden
				className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-50 text-blue-700 transition-colors dark:bg-blue-500/20 dark:text-blue-200"
			>
				←
			</span>
			<span className="pr-0.5">{label}</span>
		</Link>
	);
}

