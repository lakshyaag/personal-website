"use client";

interface EmptyStateProps {
	message?: string;
	className?: string;
}

export function EmptyState({
	message = "No entries yet. Create your first one!",
	className = "",
}: EmptyStateProps) {
	return (
		<p
			className={`text-center text-zinc-600 dark:text-zinc-400 py-8 ${className}`.trim()}
		>
			{message}
		</p>
	);
}

