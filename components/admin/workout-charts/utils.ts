export function formatLocalDate(date: Date): string {
	const y = date.getFullYear();
	const m = String(date.getMonth() + 1).padStart(2, "0");
	const d = String(date.getDate()).padStart(2, "0");
	return `${y}-${m}-${d}`;
}

export function parseDateString(dateStr: string): Date {
	const [year, month, day] = dateStr.split("-").map(Number);
	return new Date(year, month - 1, day);
}

export function formatDateLabel(dateStr: string): string {
	const date = parseDateString(dateStr);
	const month = date.toLocaleDateString("en-US", { month: "short" });
	const day = date.getDate();
	return `${month} ${day}`;
}

export function capitalize(str: string): string {
	return str.charAt(0).toUpperCase() + str.slice(1);
}

export const CHART_COLORS = {
	barActive: "bg-purple-500",
	barInactive: "bg-purple-300 dark:bg-purple-700",
	avgLine: "border-t-2 border-dashed border-zinc-500 dark:border-zinc-400",
	avgText: "text-white-500 dark:text-white-400",
} as const;

export const MUSCLE_COLORS: Record<string, string> = {
	quads: "bg-blue-500",
	hamstrings: "bg-green-500",
	glutes: "bg-purple-500",
	back: "bg-amber-500",
	lats: "bg-amber-400",
	chest: "bg-red-500",
	shoulders: "bg-pink-500",
	biceps: "bg-cyan-500",
	triceps: "bg-teal-500",
	core: "bg-orange-500",
	calves: "bg-lime-500",
	forearms: "bg-indigo-500",
};

export function getMuscleColor(muscle: string): string {
	return MUSCLE_COLORS[muscle] ?? "bg-zinc-400";
}
