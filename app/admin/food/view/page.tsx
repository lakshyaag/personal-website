"use client";

import type { FoodEntry } from "@/lib/models";
import {
	GroupedEntriesView,
	type GroupedEntry,
} from "@/components/admin/grouped-entries-view";

// Extend FoodEntry to satisfy GroupedEntry interface
type FoodViewEntry = FoodEntry & GroupedEntry;

export default function FoodViewPage() {
	return (
		<GroupedEntriesView<FoodViewEntry>
			endpoint="/api/food"
			title="Food Entries"
			entityName="food entry"
			newEntryPath="/admin/food"
			photoAltText="Food"
			renderContent={(entry) =>
				entry.description ? (
					<div className="mb-3 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
						{entry.description}
					</div>
				) : null
			}
		/>
	);
}
