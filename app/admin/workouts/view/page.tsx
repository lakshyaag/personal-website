"use client";

import type { WorkoutLog } from "@/lib/models";
import {
	GroupedEntriesView,
	type GroupedEntry,
} from "@/components/admin/grouped-entries-view";

// Extend WorkoutLog to satisfy GroupedEntry interface
type WorkoutViewEntry = WorkoutLog & GroupedEntry;

export default function WorkoutsViewPage() {
	return (
		<GroupedEntriesView<WorkoutViewEntry>
			endpoint="/api/workouts"
			title="Workout Logs"
			entityName="workout log"
			newEntryPath="/admin/workouts"
			photoAltText="Workout"
			renderContent={(entry) => (
				<>
					{entry.weight && (
						<div className="mb-2 text-sm font-medium text-zinc-900 dark:text-zinc-100">
							Weight: {entry.weight} kg
						</div>
					)}
					{entry.content && (
						<div className="mb-3 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
							{entry.content}
						</div>
					)}
				</>
			)}
		/>
	);
}

