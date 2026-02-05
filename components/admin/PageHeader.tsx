"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "motion/react";
import { VARIANTS_SECTION, TRANSITION_SECTION } from "@/lib/utils";

interface PageHeaderProps {
	title: string;
	description?: string;
	actions?: React.ReactNode;
	/** Override default "Back to Admin" link; e.g. { href: "/admin/habits", label: "Back to Habits" } */
	backLink?: { href: string; label: string };
}

export function PageHeader({
	title,
	description,
	actions,
	backLink,
}: PageHeaderProps) {
	const pathname = usePathname();
	const showBack =
		!!pathname && pathname.startsWith("/admin/") && pathname !== "/admin/login";
	const href = backLink?.href ?? "/admin";
	const label = backLink?.label ?? "Back";

	return (
		<motion.section variants={VARIANTS_SECTION} transition={TRANSITION_SECTION}>
			{showBack && (
				<div className="mb-2">
					<Link
						href={href}
						className="inline-flex items-center gap-1 text-sm text-zinc-600 transition-colors hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100"
					>
						<span aria-hidden="true">←</span>
						<span>{label}</span>
					</Link>
				</div>
			)}
			<div className="flex items-center justify-between mb-4">
				<h1 className="text-3xl font-medium">{title}</h1>
				{actions}
			</div>
			{description && (
				<p className="text-zinc-600 dark:text-zinc-400">{description}</p>
			)}
		</motion.section>
	);
}

interface SectionHeaderProps {
	title: string;
	count?: number;
	actions?: React.ReactNode;
}

export function SectionHeader({ title, count, actions }: SectionHeaderProps) {
	return (
		<div className="flex items-center justify-between">
			<h2 className="text-xl font-medium">
				{title}
				{count !== undefined && ` (${count})`}
			</h2>
			{actions}
		</div>
	);
}
