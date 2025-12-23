"use client";

import { useMemo, useState } from "react";
import { ChartEmptyState } from "./EmptyState";
import { capitalize, formatDateLabel, getMuscleColor } from "./utils";

interface MuscleGroupEntry {
	week?: string;
	date?: string;
	muscles: Record<string, number>;
}

interface MuscleGroupChartProps {
	data: MuscleGroupEntry[];
	allMuscleGroups: string[];
	mode?: "day" | "week";
}

function getKey(entry: MuscleGroupEntry): string {
	return entry.week ?? entry.date ?? "";
}

export function MuscleGroupChart({
	data,
	allMuscleGroups,
	mode = "week",
}: MuscleGroupChartProps) {
	const [selectedKey, setSelectedKey] = useState<string | null>(null);

	const { maxSets, totals, displayEntries } = useMemo(() => {
		const entries = mode === "day" ? data.slice(-30) : data;
		let maxSets = 0;
		const totals: Record<string, number> = {};

		for (const entry of entries) {
			const key = getKey(entry);
			const total = Object.values(entry.muscles).reduce((a, b) => a + b, 0);
			totals[key] = total;
			if (total > maxSets) maxSets = total;
		}

		return { maxSets: maxSets || 1, totals, displayEntries: entries };
	}, [data, mode]);

	const displayKey =
		selectedKey ?? getKey(displayEntries[displayEntries.length - 1] ?? {});
	const displayData = displayEntries.find((e) => getKey(e) === displayKey);

	if (data.length === 0) {
		return <ChartEmptyState />;
	}

	const isDaily = mode === "day";

	return (
		<div className="space-y-6">
			<div>
				<div className="flex items-end gap-1 h-24">
					{displayEntries.map((entry) => {
						const key = getKey(entry);
						const total = totals[key];
						const heightPercent = (total / maxSets) * 100;
						const isSelected = key === displayKey;

						return (
							<button
								type="button"
								key={key}
								onClick={() => setSelectedKey(key)}
								className={`flex-1 min-w-0 transition-opacity ${
									isSelected ? "opacity-100" : "opacity-60 hover:opacity-80"
								}`}
							>
								<div className="w-full h-24 flex items-end">
									<div
										className={`w-full rounded-t transition-all ${
											isSelected
												? "bg-purple-500"
												: "bg-purple-300 dark:bg-purple-700"
										}`}
										style={{ height: `${heightPercent}%`, minHeight: "2px" }}
									/>
								</div>
							</button>
						);
					})}
				</div>

				<div className="flex gap-1 mt-1">
					{displayEntries.map((entry, idx) => {
						const key = getKey(entry);
						const isSelected = key === displayKey;
						const showLabel = isDaily
							? idx === 0 || idx === displayEntries.length - 1 || idx % 7 === 0
							: true;
						return (
							<div key={`label-${key}`} className="flex-1 min-w-0">
								{showLabel && (
									<span
										className={`block text-xs truncate text-center ${
											isSelected
												? "text-purple-600 dark:text-purple-400 font-medium"
												: "text-zinc-500"
										}`}
									>
										{formatDateLabel(key)}
									</span>
								)}
							</div>
						);
					})}
				</div>
			</div>

			{displayData && (
				<div className="space-y-3">
					<h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
						{mode === "week" ? "Week of " : ""}
						{formatDateLabel(displayKey)}
					</h4>
					<div className="space-y-2">
						{allMuscleGroups.map((muscle) => {
							const sets = displayData.muscles[muscle] ?? 0;
							const maxMuscleSets = Math.max(
								...Object.values(displayData.muscles),
								1,
							);
							const widthPercent = (sets / maxMuscleSets) * 100;

							return (
								<div key={muscle} className="flex items-center gap-3">
									<span className="w-24 text-sm text-zinc-600 dark:text-zinc-400 text-right truncate">
										{capitalize(muscle)}
									</span>
									<div className="flex-1 h-5 bg-zinc-100 dark:bg-zinc-800 rounded overflow-hidden">
										<div
											className={`h-full ${getMuscleColor(muscle)} transition-all duration-300`}
											style={{ width: `${widthPercent}%` }}
										/>
									</div>
									<span className="w-14 text-sm text-zinc-600 dark:text-zinc-400 tabular-nums">
										{sets} sets
									</span>
								</div>
							);
						})}
					</div>
				</div>
			)}

			<div className="flex flex-wrap gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-700">
				{allMuscleGroups.slice(0, 8).map((muscle) => (
					<div key={muscle} className="flex items-center gap-1.5 text-xs">
						<div className={`w-3 h-3 rounded ${getMuscleColor(muscle)}`} />
						<span className="text-zinc-600 dark:text-zinc-400">
							{capitalize(muscle)}
						</span>
					</div>
				))}
			</div>
		</div>
	);
}
