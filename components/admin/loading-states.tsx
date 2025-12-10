"use client";

import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Loading Spinner
 */
interface SpinnerProps {
	size?: "sm" | "md" | "lg";
	className?: string;
}

export function Spinner({ size = "md", className }: SpinnerProps) {
	const sizeClasses = {
		sm: "h-4 w-4 border-2",
		md: "h-8 w-8 border-2",
		lg: "h-12 w-12 border-3",
	};

	return (
		<div
			className={cn(
				"inline-block animate-spin rounded-full border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-zinc-100",
				sizeClasses[size],
				className
			)}
			role="status"
			aria-label="Loading"
		>
			<span className="sr-only">Loading...</span>
		</div>
	);
}

/**
 * Loading Overlay (full screen or container)
 */
interface LoadingOverlayProps {
	message?: string;
	fullScreen?: boolean;
}

export function LoadingOverlay({
	message = "Loading...",
	fullScreen = false,
}: LoadingOverlayProps) {
	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center gap-4",
				fullScreen
					? "fixed inset-0 z-50 bg-white/80 backdrop-blur-sm dark:bg-zinc-900/80"
					: "absolute inset-0 bg-white/90 dark:bg-zinc-900/90"
			)}
		>
			<Spinner size="lg" />
			{message && (
				<p className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p>
			)}
		</div>
	);
}

/**
 * Skeleton Loader for list items
 */
interface SkeletonProps {
	count?: number;
	className?: string;
}

export function Skeleton({ count = 1, className }: SkeletonProps) {
	return (
		<>
			{Array.from({ length: count }).map((_, i) => (
				<div
					key={i}
					className={cn(
						"h-24 animate-pulse rounded-lg bg-zinc-200 dark:bg-zinc-800",
						className
					)}
				/>
			))}
		</>
	);
}

/**
 * Empty State (illustrated)
 */
interface EmptyStateProps {
	icon?: React.ReactNode;
	title: string;
	message?: string;
	action?: {
		label: string;
		onClick: () => void;
	};
}

export function EmptyState({ icon, title, message, action }: EmptyStateProps) {
	return (
		<motion.div
			initial={{ opacity: 0, y: 10 }}
			animate={{ opacity: 1, y: 0 }}
			className="flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-zinc-300 bg-zinc-50 px-8 py-12 text-center dark:border-zinc-700 dark:bg-zinc-900/50"
		>
			{icon && (
				<div className="mb-4 text-zinc-400 dark:text-zinc-600">{icon}</div>
			)}
			<h3 className="text-lg font-medium text-zinc-900 dark:text-zinc-100">
				{title}
			</h3>
			{message && (
				<p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
					{message}
				</p>
			)}
			{action && (
				<button
					type="button"
					onClick={action.onClick}
					className="mt-4 rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
				>
					{action.label}
				</button>
			)}
		</motion.div>
	);
}

/**
 * Inline Loading Text
 */
interface LoadingTextProps {
	text?: string;
	className?: string;
}

export function LoadingText({
	text = "Loading",
	className,
}: LoadingTextProps) {
	return (
		<div className={cn("flex items-center gap-2", className)}>
			<Spinner size="sm" />
			<span className="text-sm text-zinc-600 dark:text-zinc-400">{text}</span>
		</div>
	);
}

/**
 * Button Loading State
 */
interface LoadingButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement> {
	loading?: boolean;
	children: React.ReactNode;
}

export function LoadingButton({
	loading,
	disabled,
	children,
	className,
	...props
}: LoadingButtonProps) {
	return (
		<button
			disabled={disabled || loading}
			className={cn(
				"inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50",
				className
			)}
			{...props}
		>
			{loading && <Spinner size="sm" />}
			{children}
		</button>
	);
}

/**
 * Progress Bar
 */
interface ProgressBarProps {
	progress: number; // 0-100
	label?: string;
	showPercentage?: boolean;
}

export function ProgressBar({
	progress,
	label,
	showPercentage = true,
}: ProgressBarProps) {
	const clampedProgress = Math.max(0, Math.min(100, progress));

	return (
		<div className="w-full">
			{(label || showPercentage) && (
				<div className="mb-2 flex items-center justify-between text-sm">
					{label && (
						<span className="text-zinc-700 dark:text-zinc-300">{label}</span>
					)}
					{showPercentage && (
						<span className="text-zinc-600 dark:text-zinc-400">
							{Math.round(clampedProgress)}%
						</span>
					)}
				</div>
			)}
			<div className="h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
				<motion.div
					className="h-full bg-zinc-900 dark:bg-zinc-100"
					initial={{ width: 0 }}
					animate={{ width: `${clampedProgress}%` }}
					transition={{ duration: 0.3 }}
				/>
			</div>
		</div>
	);
}
