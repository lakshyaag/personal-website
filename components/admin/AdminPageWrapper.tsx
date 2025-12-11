"use client";

import { Suspense } from "react";
import { motion } from "motion/react";
import {
	VARIANTS_CONTAINER,
	VARIANTS_SECTION,
	TRANSITION_SECTION,
} from "@/lib/utils";

interface AdminPageWrapperProps {
	children: React.ReactNode;
}

export function AdminPageWrapper({ children }: AdminPageWrapperProps) {
	return (
		<motion.main
			className="space-y-8 pb-16"
			variants={VARIANTS_CONTAINER}
			initial="hidden"
			animate="visible"
		>
			{children}
		</motion.main>
	);
}

interface AdminSectionProps {
	children: React.ReactNode;
	className?: string;
}

export function AdminSection({ children, className = "" }: AdminSectionProps) {
	return (
		<motion.section
			className={className}
			variants={VARIANTS_SECTION}
			transition={TRANSITION_SECTION}
		>
			{children}
		</motion.section>
	);
}

interface AdminPageWithSuspenseProps {
	children: React.ReactNode;
	fallbackTitle?: string;
	fallbackDescription?: string;
}

export function AdminPageWithSuspense({
	children,
	fallbackTitle = "Loading...",
	fallbackDescription,
}: AdminPageWithSuspenseProps) {
	return (
		<Suspense
			fallback={
				<AdminPageWrapper>
					<motion.section
						variants={VARIANTS_SECTION}
						transition={TRANSITION_SECTION}
					>
						<div className="flex items-center justify-between mb-4">
							<h1 className="text-3xl font-medium">{fallbackTitle}</h1>
						</div>
						{fallbackDescription && (
							<p className="text-zinc-600 dark:text-zinc-400">
								{fallbackDescription}
							</p>
						)}
					</motion.section>
				</AdminPageWrapper>
			}
		>
			{children}
		</Suspense>
	);
}

