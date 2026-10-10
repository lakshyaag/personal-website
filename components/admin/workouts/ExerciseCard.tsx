import type { WorkoutExercise } from "@/shared/workouts";

export function ExerciseCard({ exercise }: { exercise: WorkoutExercise }) {
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

			{(isCardio || exercise.duration) && (
				<div className="flex gap-4 text-sm">
					{exercise.duration && (
						<span className="text-zinc-600 dark:text-zinc-400">
							Duration: {exercise.duration}
						</span>
					)}
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
