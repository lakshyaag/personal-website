"use client";

type ViewMode = "date" | "all";

interface ViewModeToggleProps {
	viewMode: ViewMode;
	onViewModeChange: (mode: ViewMode) => void;
	dateLabel?: string;
	allLabel?: string;
}

export function ViewModeToggle({
	viewMode,
	onViewModeChange,
	dateLabel = "By Date",
	allLabel = "All Entries",
}: ViewModeToggleProps) {
	const baseClasses =
		"px-4 py-2 rounded-lg text-sm font-medium transition-colors";
	const activeClasses =
		"bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900";
	const inactiveClasses =
		"bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700";

	return (
		<div className="flex gap-2">
			<button
				type="button"
				onClick={() => onViewModeChange("date")}
				className={`${baseClasses} ${viewMode === "date" ? activeClasses : inactiveClasses}`}
			>
				{dateLabel}
			</button>
			<button
				type="button"
				onClick={() => onViewModeChange("all")}
				className={`${baseClasses} ${viewMode === "all" ? activeClasses : inactiveClasses}`}
			>
				{allLabel}
			</button>
		</div>
	);
}

export type { ViewMode };

