"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { createClient } from "@/lib/supabase-client";
import { toast } from "sonner";
import {
	VARIANTS_CONTAINER,
	VARIANTS_SECTION,
	TRANSITION_SECTION,
} from "@/lib/utils";

export default function AdminPage() {
	const router = useRouter();
	const sections = [
		{
			title: "Books",
			description: "Manage your reading library",
			href: "/admin/books",
		},
		{
			title: "Airports",
			description: "Track visited airports",
			href: "/admin/airports",
		},
		{
			title: "Workouts",
			description: "Track your fitness journey",
			href: "/admin/workouts",
		},
		{
			title: "Journal",
			description: "Write and view journal entries",
			href: "/admin/journal",
		},
		{
			title: "Food Tracker",
			description: "Track your daily food intake",
			href: "/admin/food",
		},
	];

	const handleLogout = async () => {
		const supabase = createClient();
		await supabase.auth.signOut();
		toast.success("Logged out successfully");
		router.push("/admin/login");
		router.refresh();
	};

	return (
		<motion.main
			className="space-y-8 pb-16"
			variants={VARIANTS_CONTAINER}
			initial="hidden"
			animate="visible"
		>
			<motion.section
				variants={VARIANTS_SECTION}
				transition={TRANSITION_SECTION}
			>
				<div className="flex items-center justify-between mb-4">
					<h1 className="text-3xl font-medium">Admin</h1>
					<button
						type="button"
						onClick={handleLogout}
						className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-md hover:bg-red-700 transition-colors"
					>
						Logout
					</button>
				</div>
				<p className="text-zinc-600 dark:text-zinc-400">
					Manage your personal data.
				</p>
			</motion.section>

			<motion.section
				className="grid grid-cols-1 gap-4 sm:grid-cols-2"
				variants={VARIANTS_SECTION}
				transition={TRANSITION_SECTION}
			>
				{sections.map((section) => (
					<Link
						key={section.href}
						href={section.href}
						className="group rounded-lg border border-zinc-300 bg-white p-6 transition-all hover:border-zinc-500 hover:shadow-md dark:border-zinc-700 dark:bg-zinc-900/50 dark:hover:border-zinc-500"
					>
						<h2 className="mb-2 text-lg font-medium transition-colors group-hover:text-zinc-700 dark:group-hover:text-zinc-300">
							{section.title}
						</h2>
						<p className="text-sm text-zinc-600 dark:text-zinc-400">
							{section.description}
						</p>
					</Link>
				))}
			</motion.section>
		</motion.main>
	);
}
