"use client";

import type { JournalEntry } from "@/lib/models";
import {
	GroupedEntriesView,
	type GroupedEntry,
} from "@/components/admin/grouped-entries-view";

// Extend JournalEntry to satisfy GroupedEntry interface
type JournalViewEntry = JournalEntry & GroupedEntry;

export default function JournalViewPage() {
	return (
		<GroupedEntriesView<JournalViewEntry>
			endpoint="/api/journal"
			title="Journal Entries"
			entityName="journal entry"
			newEntryPath="/admin/journal"
			photoAltText="Journal"
			renderContent={(entry) =>
				entry.content ? (
					<div className="mb-3 whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
						{entry.content}
					</div>
				) : null
			}
		/>
	);
}
