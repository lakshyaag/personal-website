"use client";

import type { WorkoutExercise, WorkoutLog } from "@/lib/models";
import { Check, Dumbbell, Loader2, RefreshCw, Sparkles, X } from "lucide-react";
import { useMemo } from "react";

export interface WorkoutAnalysisResult {
	sessionType: "strength" | "cardio" | "mixed" | "other";
	exercises: WorkoutExercise[];
	totalVolume: number | null;
	muscleGroups: string[];
	notes: string | null;
	metadataId: string;
}

interface WorkoutAnalysisModalProps {
	entry: WorkoutLog | null;
	onClose: () => void;
	isAnalyzing: boolean;
	analysisResult: WorkoutAnalysisResult | null;
	onAnalyze: (entry: WorkoutLog) => void;
}

function ExerciseCard({ exercise }: { exercise: WorkoutExercise }) {
	const hasSets = exercise.sets && exercise.sets.length > 0;
	const isCardio = exercise.category === "cardio";

	return (
		<div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50 space-y-2">
			<div className="flex items-center justify-between">
				<h4 className="font-medium text-zinc-900 dark:text-zinc-100">
					{exercise.name}
				</h4>
				<span className="text-xs px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400">
					{exercise.category}
				</span>
			</div>

			{exercise.muscleGroups.length > 0 && (
				<div className="flex flex-wrap gap-1">
					{exercise.muscleGroups.map((muscle) => (
						<span
							key={muscle}
							className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
						>
							{muscle}
						</span>
					))}
				</div>
			)}

			{hasSets && (
				<div className="grid grid-cols-3 gap-2 text-sm">
					<div className="text-zinc-500 dark:text-zinc-400">Set</div>
					<div className="text-zinc-500 dark:text-zinc-400">Weight</div>
					<div className="text-zinc-500 dark:text-zinc-400">Reps</div>
					{exercise.sets?.map((set, idx) => {
						const setKey = `${set.weight ?? "bw"}-${set.reps ?? 0}-${idx}`;
						return (
							<div key={setKey} className="contents">
								<div className="text-zinc-700 dark:text-zinc-300">
									{idx + 1}
								</div>
								<div className="text-zinc-700 dark:text-zinc-300">
									{set.weight ? `${set.weight} lbs` : "BW"}
								</div>
								<div className="text-zinc-700 dark:text-zinc-300">
									{set.reps ?? "-"}
								</div>
							</div>
						);
					})}
				</div>
			)}

			{isCardio && (
				<div className="flex gap-4 text-sm">
					{exercise.incline && (
						<span className="text-zinc-600 dark:text-zinc-400">
							Incline: {exercise.incline}
						</span>
					)}
					{exercise.speed && (
						<span className="text-zinc-600 dark:text-zinc-400">
							Speed: {exercise.speed}
						</span>
					)}
				</div>
			)}

			{exercise.notes && (
				<p className="text-xs text-zinc-500 dark:text-zinc-500 italic">
					{exercise.notes}
				</p>
			)}
		</div>
	);
}

export function WorkoutAnalysisModal({
	entry,
	onClose,
	isAnalyzing,
	analysisResult,
	onAnalyze,
}: WorkoutAnalysisModalProps) {
	const justAnalyzed = !!analysisResult;

	const hasExistingAnalysis = useMemo(() => {
		return !!(entry?.aiSessionType && entry.aiExercises);
	}, [entry]);

	const existingAnalysis = useMemo<WorkoutAnalysisResult | null>(() => {
		if (!hasExistingAnalysis || !entry) return null;
		return {
			sessionType: entry.aiSessionType ?? "other",
			exercises: entry.aiExercises ?? [],
			totalVolume: entry.aiTotalVolume ?? null,
			muscleGroups: entry.aiMuscleGroups ?? [],
			notes: entry.aiNotes ?? null,
			metadataId: entry.aiMetadataId ?? "",
		};
	}, [hasExistingAnalysis, entry]);

	function handleReAnalyze() {
		if (entry) {
			onAnalyze(entry);
		}
	}

	if (!entry) return null;

	const displayResult = analysisResult || existingAnalysis;

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
			<div className="relative w-full max-w-2xl max-h-[80vh] overflow-hidden rounded-xl bg-white dark:bg-zinc-900 shadow-2xl">
				<div className="flex items-center justify-between border-b border-zinc-200 dark:border-zinc-700 px-6 py-4">
					<div className="flex items-center gap-2">
						<Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
						<h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
							AI Workout Analysis
						</h2>
					</div>
					<button
						type="button"
						onClick={onClose}
						className="p-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
					>
						<X className="w-5 h-5 text-zinc-500" />
					</button>
				</div>

				<div className="px-6 py-4 overflow-y-auto max-h-[calc(80vh-140px)]">
					<div className="mb-4 p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
						<p className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-pre-wrap">
							<span className="font-medium">Entry:</span>{" "}
							{entry.content || "Photo(s) only"}
						</p>
						{entry.photos && entry.photos.length > 0 && (
							<p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
								{entry.photos.length} photo(s) included
							</p>
						)}
					</div>

					{isAnalyzing && (
						<div className="flex flex-col items-center justify-center gap-4 py-12 text-zinc-500">
							<Loader2 className="w-8 h-8 animate-spin text-purple-600" />
							<div className="text-center">
								<p className="font-medium text-zinc-900 dark:text-zinc-100">
									Analyzing your workout...
								</p>
								<p className="text-sm">This usually takes 5-10 seconds</p>
							</div>
						</div>
					)}

					{displayResult && !isAnalyzing && (
						<div className="space-y-4">
							<div className="flex items-center gap-3">
								<Dumbbell className="w-5 h-5 text-purple-600 dark:text-purple-400" />
								<span className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 capitalize">
									{displayResult.sessionType} Session
								</span>
							</div>

							<div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
								<div className="p-3 rounded-lg bg-purple-50 dark:bg-purple-900/20 text-center">
									<div className="text-2xl font-bold text-purple-700 dark:text-purple-400">
										{displayResult.exercises.length}
									</div>
									<div className="text-xs text-purple-600 dark:text-purple-500">
										Exercises
									</div>
								</div>
								{displayResult.totalVolume && (
									<div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 text-center">
										<div className="text-2xl font-bold text-blue-700 dark:text-blue-400">
											{displayResult.totalVolume.toLocaleString()}
										</div>
										<div className="text-xs text-blue-600 dark:text-blue-500">
											Total Volume (lbs)
										</div>
									</div>
								)}
							</div>

							{displayResult.muscleGroups.length > 0 && (
								<div>
									<h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
										Muscle Groups
									</h4>
									<div className="flex flex-wrap gap-2">
										{displayResult.muscleGroups.map((muscle) => (
											<span
												key={muscle}
												className="px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 text-sm"
											>
												{muscle}
											</span>
										))}
									</div>
								</div>
							)}

							<div>
								<h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
									Exercises
								</h4>
								<div className="space-y-2">
									{displayResult.exercises.map((exercise, idx) => (
										<ExerciseCard
											key={`${exercise.name}-${idx}`}
											exercise={exercise}
										/>
									))}
								</div>
							</div>

							{displayResult.notes && (
								<div className="p-3 rounded-lg bg-zinc-50 dark:bg-zinc-800/50">
									<h4 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">
										Notes
									</h4>
									<p className="text-sm text-zinc-600 dark:text-zinc-400">
										{displayResult.notes}
									</p>
								</div>
							)}
						</div>
					)}
				</div>

				<div className="border-t border-zinc-200 dark:border-zinc-700 px-6 py-3 flex items-center justify-between">
					<div className="flex items-center gap-2">
						{displayResult && !isAnalyzing && (
							<span className="text-sm text-purple-600 dark:text-purple-400 flex items-center gap-1">
								<Check className="w-4 h-4" />
								{justAnalyzed ? "Analysis complete" : "Saved from background"}
							</span>
						)}
					</div>
					<div className="flex items-center gap-2 ml-auto">
						{displayResult && !isAnalyzing && (
							<button
								type="button"
								onClick={handleReAnalyze}
								disabled={isAnalyzing}
								className="px-4 py-2 text-sm font-medium rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
							>
								<RefreshCw className="w-4 h-4" />
								Re-analyze
							</button>
						)}
						<button
							type="button"
							onClick={onClose}
							className="px-4 py-2 text-sm font-medium rounded-lg bg-zinc-100 text-zinc-900 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:hover:bg-zinc-700 transition-colors"
						>
							Close
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}
