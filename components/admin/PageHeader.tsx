"use client";

import { motion } from "motion/react";
import { VARIANTS_SECTION, TRANSITION_SECTION } from "@/lib/utils";

interface PageHeaderProps {
	title: string;
	description?: string;
	actions?: React.ReactNode;
}

export function PageHeader({ title, description, actions }: PageHeaderProps) {
	return (
		<motion.section
			variants={VARIANTS_SECTION}
			transition={TRANSITION_SECTION}
		>
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

