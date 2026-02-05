"use client";

import { Flame } from "lucide-react";

interface StreakBadgeProps {
	streak: number;
	size?: "sm" | "md";
}

export function StreakBadge({ streak, size = "md" }: StreakBadgeProps) {
	if (streak === 0) return null;

	const sizeClasses = {
		sm: "text-xs gap-0.5",
		md: "text-sm gap-1",
	};

	const iconSize = size === "sm" ? 12 : 14;

	return (
		<span
			className={`inline-flex items-center font-medium text-orange-500 dark:text-orange-400 ${sizeClasses[size]}`}
		>
			<Flame size={iconSize} className="fill-current" />
			{streak}
		</span>
	);
}
