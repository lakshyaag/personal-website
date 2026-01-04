"use client";

import type { WorkoutExercise } from "@/lib/models";
import { Clock, History, Info, X } from "lucide-react";
import { formatDate } from "@/lib/date-utils";

interface ExerciseHistoryCardProps {
	exerciseName: string;
	lastPerformed: string;
	sets: NonNullable<WorkoutExercise["sets"]>;
	notes?: string | null;
	onViewHistory: () => void;
	onClear?: () => void;
}

export function ExerciseHistoryCard({
	exerciseName,
	lastPerformed,
	sets,
	notes,
	onViewHistory,
	onClear,
}: ExerciseHistoryCardProps) {
	return (
		<div className="relative rounded-xl border border-purple-200 dark:border-purple-800/50 bg-gradient-to-br from-purple-50/80 to-purple-100/40 dark:from-purple-900/20 dark:to-purple-900/10 p-5 space-y-4 shadow-sm">
			{onClear && (
				<button
					type="button"
					onClick={onClear}
					className="absolute top-3 right-3 p-1.5 rounded-lg hover:bg-purple-200/60 dark:hover:bg-purple-800/60 text-purple-600 dark:text-purple-400 transition-colors group"
					aria-label="Close"
				>
					<X className="w-4 h-4 group-hover:scale-110 transition-transform" />
				</button>
			)}
			<div className="flex items-start justify-between pr-10">
				<div className="space-y-1.5 flex-1">
					<h3 className="font-semibold text-lg text-purple-900 dark:text-purple-200 flex items-center gap-2">
						<History className="w-5 h-5 text-purple-600 dark:text-purple-400" />
						{exerciseName}
					</h3>
					<div className="flex items-center gap-1.5 text-sm text-purple-700/80 dark:text-purple-300/80">
						<Clock className="w-4 h-4" />
						<span>Last performed: {formatDate(lastPerformed)}</span>
					</div>
				</div>
				<button
					type="button"
					onClick={onViewHistory}
					className="text-sm font-medium text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 hover:underline transition-colors whitespace-nowrap ml-4"
				>
					View Full History
				</button>
			</div>

			{sets.length > 0 && (
				<div className="grid grid-cols-2 gap-2.5">
					{sets.map((set, idx) => {
						const setKey = `set-${idx}-${set.weight}-${set.reps}`;
						return (
							<div
								key={setKey}
								className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-white/80 dark:bg-zinc-800/80 border border-purple-200/60 dark:border-purple-800/40 text-sm shadow-sm"
							>
								<span className="text-purple-600 dark:text-purple-400 font-semibold min-w-[1.5rem]">
									{idx + 1}
								</span>
								<span className="text-zinc-700 dark:text-zinc-300 font-medium">
									{set.weight ? `${set.weight} lbs` : "BW"} × {set.reps ?? "?"}
								</span>
							</div>
						);
					})}
				</div>
			)}

			{notes && (
				<div className="flex items-start gap-2.5 p-3 rounded-lg bg-white/60 dark:bg-zinc-800/60 border border-purple-200/40 dark:border-purple-800/30 text-sm text-zinc-700 dark:text-zinc-300">
					<Info className="w-4 h-4 mt-0.5 flex-shrink-0 text-purple-600 dark:text-purple-400" />
					<span className="italic">{notes}</span>
				</div>
			)}
		</div>
	);
}
