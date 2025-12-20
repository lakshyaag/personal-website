import type { FoodEntry } from "@/lib/models";
import { useMemo } from "react";

interface FoodDashboardProps {
	entries: FoodEntry[];
	compact?: boolean;
}

export function FoodDashboard({
	entries,
	compact = false,
}: FoodDashboardProps) {
	const stats = useMemo(() => {
		const totals = entries.reduce(
			(acc, entry) => {
				if (entry.aiCalories) {
					acc.calories += entry.aiCalories;
					acc.protein += entry.aiProteinG || 0;
					acc.carbs += entry.aiCarbsG || 0;
					acc.fat += entry.aiFatG || 0;
					acc.hasData = true;
				}
				return acc;
			},
			{ calories: 0, protein: 0, carbs: 0, fat: 0, hasData: false },
		);

		const totalMacros = totals.protein + totals.carbs + totals.fat;

		return {
			...totals,
			proteinPct: totalMacros > 0 ? (totals.protein / totalMacros) * 100 : 0,
			carbsPct: totalMacros > 0 ? (totals.carbs / totalMacros) * 100 : 0,
			fatPct: totalMacros > 0 ? (totals.fat / totalMacros) * 100 : 0,
		};
	}, [entries]);

	if (!stats.hasData) return null;

	if (compact) {
		return (
			<div className="flex items-center gap-4 text-xs text-zinc-600 dark:text-zinc-400">
				<div className="flex items-center gap-1.5">
					<div className="w-2 h-2 rounded-full bg-green-500" />
					<span>{Math.round(stats.calories)} kcal</span>
				</div>
				<div className="flex items-center gap-3">
					<span className="flex items-center gap-1">
						<span className="text-zinc-400">P:</span>{" "}
						{Math.round(stats.protein)}g
					</span>
					<span className="flex items-center gap-1">
						<span className="text-zinc-400">C:</span> {Math.round(stats.carbs)}g
					</span>
					<span className="flex items-center gap-1">
						<span className="text-zinc-400">F:</span> {Math.round(stats.fat)}g
					</span>
				</div>
			</div>
		);
	}

	return (
		<div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-6 shadow-sm">
			<div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
				<div>
					<p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-1">
						Total Calories
					</p>
					<div className="flex items-baseline gap-2">
						<span className="text-4xl font-bold text-zinc-900 dark:text-zinc-100">
							{Math.round(stats.calories)}
						</span>
						<span className="text-lg text-zinc-500 dark:text-zinc-400">
							kcal
						</span>
					</div>
				</div>

				<div className="flex-1 max-w-md">
					<div className="flex justify-between text-sm mb-2">
						<div className="flex items-center gap-4">
							<div className="flex items-center gap-1.5">
								<div className="w-3 h-3 rounded-full bg-blue-500" />
								<span className="font-medium text-zinc-700 dark:text-zinc-300">
									Protein: {Math.round(stats.protein)}g
								</span>
							</div>
							<div className="flex items-center gap-1.5">
								<div className="w-3 h-3 rounded-full bg-amber-500" />
								<span className="font-medium text-zinc-700 dark:text-zinc-300">
									Carbs: {Math.round(stats.carbs)}g
								</span>
							</div>
							<div className="flex items-center gap-1.5">
								<div className="w-3 h-3 rounded-full bg-rose-500" />
								<span className="font-medium text-zinc-700 dark:text-zinc-300">
									Fat: {Math.round(stats.fat)}g
								</span>
							</div>
						</div>
					</div>

					<div className="h-3 w-full flex rounded-full overflow-hidden bg-zinc-100 dark:bg-zinc-800">
						<div
							className="h-full bg-blue-500 transition-all duration-500"
							style={{ width: `${stats.proteinPct}%` }}
							title={`Protein: ${Math.round(stats.proteinPct)}%`}
						/>
						<div
							className="h-full bg-amber-500 transition-all duration-500"
							style={{ width: `${stats.carbsPct}%` }}
							title={`Carbs: ${Math.round(stats.carbsPct)}%`}
						/>
						<div
							className="h-full bg-rose-500 transition-all duration-500"
							style={{ width: `${stats.fatPct}%` }}
							title={`Fat: ${Math.round(stats.fatPct)}%`}
						/>
					</div>
				</div>
			</div>
		</div>
	);
}
