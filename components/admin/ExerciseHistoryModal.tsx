"use client";

import { formatDate } from "@/lib/date-utils";
import type { WorkoutExercise } from "@/shared/workouts";
import { Calendar } from "lucide-react";
import { useEffect, useState } from "react";
import { Sheet } from "./kit";

interface HistoryEntry {
	date: string;
	sets: NonNullable<WorkoutExercise["sets"]>;
	notes?: string | null;
	category: string;
	muscleGroups: string[];
}

interface ExerciseHistoryModalProps {
	exerciseName: string;
	onClose: () => void;
}

export function ExerciseHistoryModal({
	exerciseName,
	onClose,
}: ExerciseHistoryModalProps) {
	const [history, setHistory] = useState<HistoryEntry[]>([]);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		async function fetchHistory() {
			try {
				const res = await fetch(
					`/api/admin/workouts/exercises/${encodeURIComponent(exerciseName)}`,
				);
				const data = await res.json();
				setHistory(data.history || []);
			} catch (error) {
				console.error("Failed to fetch exercise history:", error);
			} finally {
				setLoading(false);
			}
		}
		fetchHistory();
	}, [exerciseName]);

	return (
		<Sheet open onClose={onClose} title={exerciseName}>
			<div className="flex-1 space-y-6 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
				{loading ? (
					<div className="py-20 text-center text-zinc-500">
						Loading history...
					</div>
				) : history.length === 0 ? (
					<div className="py-20 text-center text-zinc-500">
						No history found for this exercise.
					</div>
				) : (
					<div className="relative border-l-2 border-zinc-100 dark:border-zinc-800 ml-3 space-y-8">
						{history.map((entry) => (
							<div key={entry.date} className="relative pl-8">
								<div className="absolute -left-[9px] top-1 w-4 h-4 rounded-full border-2 border-white dark:border-zinc-900 bg-purple-500" />
								<div className="space-y-3">
									<div className="flex items-center gap-2 text-sm font-semibold text-zinc-900 dark:text-zinc-100">
										<Calendar className="w-4 h-4 text-zinc-400" />
										{formatDate(entry.date)}
									</div>
									<div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
										{entry.sets.map((set, sIdx) => (
											<div
												key={`${entry.date}-set-${sIdx}`}
												className="p-2 rounded-lg bg-zinc-50 dark:bg-zinc-800 border border-zinc-100 dark:border-zinc-700 text-center"
											>
												<div className="text-xs text-zinc-500 mb-1">
													Set {sIdx + 1}
												</div>
												<div className="text-sm font-medium">
													{set.weight ? `${set.weight} lbs` : "BW"} × {set.reps}
												</div>
											</div>
										))}
									</div>
									{entry.notes && (
										<div className="text-sm text-zinc-600 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-800/50 p-3 rounded-lg border border-zinc-100 dark:border-zinc-800 italic">
											{entry.notes}
										</div>
									)}
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</Sheet>
	);
}
