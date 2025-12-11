"use client";

import { formatDate } from "@/lib/date-utils";
import { EntryCardList } from "./EntryCard";
import { EmptyState } from "./EmptyState";

interface GroupedEntriesListProps<T> {
	groupedEntries: Record<string, T[]>;
	renderEntry: (entry: T) => React.ReactNode;
	emptyMessage?: string;
	getEntryKey: (entry: T) => string;
}

export function GroupedEntriesList<T>({
	groupedEntries,
	renderEntry,
	emptyMessage = "No entries yet. Create your first one!",
	getEntryKey,
}: GroupedEntriesListProps<T>) {
	const sortedDates = Object.keys(groupedEntries).sort((a, b) =>
		b.localeCompare(a),
	);

	if (sortedDates.length === 0) {
		return <EmptyState message={emptyMessage} />;
	}

	return (
		<div className="space-y-6">
			{sortedDates.map((entryDate) => (
				<div key={entryDate} className="space-y-3">
					<h3 className="text-lg font-medium text-zinc-700 dark:text-zinc-300 sticky top-0 bg-white dark:bg-zinc-950 py-2">
						{formatDate(entryDate)} ({groupedEntries[entryDate].length})
					</h3>
					<EntryCardList>
						{groupedEntries[entryDate].map((entry) => (
							<div key={getEntryKey(entry)}>{renderEntry(entry)}</div>
						))}
					</EntryCardList>
				</div>
			))}
		</div>
	);
}

