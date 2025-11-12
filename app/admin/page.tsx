"use client";

import Link from "next/link";
import { motion } from "motion/react";
import {
	VARIANTS_CONTAINER,
	VARIANTS_SECTION,
	TRANSITION_SECTION,
} from "@/lib/utils";

export default function AdminPage() {
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
	];

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
				<h1 className="mb-4 text-3xl font-medium">Admin</h1>
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
