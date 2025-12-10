"use client";

import { useState, useEffect, useCallback } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import { toast } from "sonner";
import {
	VARIANTS_CONTAINER,
	VARIANTS_SECTION,
	TRANSITION_SECTION,
} from "@/lib/utils";
import { formatDate, formatTime } from "@/lib/date-utils";
import { apiGet, apiDelete } from "@/lib/api-utils";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { LoadingText } from "@/components/admin/loading-states";

/**
 * Base interface for entries that can be displayed in the grouped view
 */
export interface GroupedEntry {
	id: string;
	date: string;
	createdAt: string;
	photos?: string[];
}

/**
 * Configuration for the grouped entries view
 */
export interface GroupedEntriesViewConfig<T extends GroupedEntry> {
	/** API endpoint for fetching entries (e.g., "/api/food") */
	endpoint: string;
	/** Title displayed at the top (e.g., "Food Entries") */
	title: string;
	/** Singular entity name for messages (e.g., "food entry") */
	entityName: string;
	/** Link to the new entry page (e.g., "/admin/food") */
	newEntryPath: string;
	/** Alt text for photos (e.g., "Food") */
	photoAltText: string;
	/** Render function for entry content (text portion) */
	renderContent: (entry: T) => React.ReactNode;
}

/**
 * Get relative date string (Today, Yesterday, or null)
 */
function getRelativeDate(dateStr: string): string | null {
	const [year, month, day] = dateStr.split("-").map(Number);
	const date = new Date(year, month - 1, day);
	const today = new Date();
	today.setHours(0, 0, 0, 0);
	const yesterday = new Date(today);
	yesterday.setDate(yesterday.getDate() - 1);

	date.setHours(0, 0, 0, 0);

	if (date.getTime() === today.getTime()) return "Today";
	if (date.getTime() === yesterday.getTime()) return "Yesterday";
	return null;
}

/**
 * Shared component for viewing grouped entries by date
 * Used by food and journal view pages
 */
export function GroupedEntriesView<T extends GroupedEntry>({
	endpoint,
	title,
	entityName,
	newEntryPath,
	photoAltText,
	renderContent,
}: GroupedEntriesViewConfig<T>) {
	const [groupedEntries, setGroupedEntries] = useState<Record<string, T[]>>({});
	const [loading, setLoading] = useState(true);
	const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
	const { ConfirmDialog, confirm } = useConfirmDialog();

	const loadEntries = useCallback(async () => {
		setLoading(true);
		try {
			const result = await apiGet<Record<string, T[]>>(
				`${endpoint}?grouped=true`
			);

			if (!result.success || !result.data) {
				throw new Error(result.error || "Failed to load entries");
			}

			setGroupedEntries(result.data);
			// Expand the most recent 3 dates by default
			const dates = Object.keys(result.data).slice(0, 3);
			setExpandedDates(new Set(dates));
		} catch (err) {
			console.error(`Failed to load ${entityName}s:`, err);
			toast.error(`Failed to load ${entityName}s`);
		} finally {
			setLoading(false);
		}
	}, [endpoint, entityName]);

	useEffect(() => {
		loadEntries();
	}, [loadEntries]);

	function toggleDate(date: string) {
		const newExpanded = new Set(expandedDates);
		if (newExpanded.has(date)) {
			newExpanded.delete(date);
		} else {
			newExpanded.add(date);
		}
		setExpandedDates(newExpanded);
	}

	async function deleteEntry(entryId: string) {
		const capitalizedName =
			entityName.charAt(0).toUpperCase() + entityName.slice(1);

		const confirmed = await confirm({
			title: `Delete ${capitalizedName}?`,
			message: "This action cannot be undone.",
			variant: "danger",
			confirmLabel: "Delete",
		});

		if (!confirmed) return;

		try {
			const result = await apiDelete(endpoint, entryId);

			if (!result.success) {
				throw new Error(result.error || "Delete failed");
			}

			toast.success("Entry deleted successfully!");
			await loadEntries();
		} catch (err) {
			console.error("Delete error:", err);
			toast.error("Failed to delete entry");
		}
	}

	const sortedDates = Object.keys(groupedEntries).sort((a, b) =>
		b.localeCompare(a)
	);
	const totalEntries = Object.values(groupedEntries).reduce(
		(sum, entries) => sum + entries.length,
		0
	);

	if (loading) {
		return (
			<motion.main
				className="space-y-8 pb-16"
				variants={VARIANTS_CONTAINER}
				initial="hidden"
				animate="visible"
			>
				<motion.section
					variants={VARIANTS_SECTION}
					transition={TRANSITION_SECTION}
				>
					<LoadingText text="Loading entries..." />
				</motion.section>
			</motion.main>
		);
	}

	return (
		<>
			<ConfirmDialog />
			<motion.main
				className="space-y-8 pb-16"
				variants={VARIANTS_CONTAINER}
				initial="hidden"
				animate="visible"
			>
				<motion.section
					variants={VARIANTS_SECTION}
					transition={TRANSITION_SECTION}
				>
					<div className="mb-4 flex items-center justify-between">
						<h1 className="text-3xl font-medium">{title}</h1>
						<Link
							href={newEntryPath}
							className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
						>
							← New Entry
						</Link>
					</div>
					<p className="text-zinc-600 dark:text-zinc-400">
						{totalEntries} {totalEntries === 1 ? "entry" : "entries"} across{" "}
						{sortedDates.length} {sortedDates.length === 1 ? "day" : "days"}
					</p>
				</motion.section>

				{sortedDates.length === 0 ? (
					<motion.section
						variants={VARIANTS_SECTION}
						transition={TRANSITION_SECTION}
					>
						<div className="py-12 text-center">
							<p className="mb-4 text-zinc-600 dark:text-zinc-400">
								No {entityName}s yet.
							</p>
							<Link
								href={newEntryPath}
								className="text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
							>
								Create your first entry →
							</Link>
						</div>
					</motion.section>
				) : (
					<motion.section
						className="space-y-4"
						variants={VARIANTS_SECTION}
						transition={TRANSITION_SECTION}
					>
						{sortedDates.map((date) => {
							const entries = groupedEntries[date];
							const isExpanded = expandedDates.has(date);
							const relativeDate = getRelativeDate(date);

							return (
								<div
									key={date}
									className="overflow-hidden rounded-lg border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900/50"
								>
									<button
										type="button"
										onClick={() => toggleDate(date)}
										className="w-full p-4 text-left transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
									>
										<div className="flex items-center justify-between">
											<div>
												<div className="text-lg font-medium">
													{formatDate(date)}
													{relativeDate && (
														<span className="ml-2 text-sm text-zinc-500">
															({relativeDate})
														</span>
													)}
												</div>
												<div className="text-sm text-zinc-600 dark:text-zinc-400">
													{entries.length}{" "}
													{entries.length === 1 ? "entry" : "entries"}
												</div>
											</div>
											<div className="text-zinc-400 dark:text-zinc-600">
												{isExpanded ? "🔽" : "▶️"}
											</div>
										</div>
									</button>

									{isExpanded && (
										<div className="space-y-3 border-t border-zinc-200 p-4 dark:border-zinc-800">
											{entries.map((entry) => (
												<div
													key={entry.id}
													className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-900"
												>
													<div className="mb-2 flex items-start justify-between">
														<div className="text-xs text-zinc-500">
															{formatTime(entry.createdAt)}
														</div>
														<div className="flex gap-2">
															<Link
																href={`${newEntryPath}?edit=${entry.id}`}
																className="text-xs text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
															>
																Edit
															</Link>
															<button
																type="button"
																onClick={() => deleteEntry(entry.id)}
																className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
															>
																Delete
															</button>
														</div>
													</div>

													{renderContent(entry)}

													{entry.photos && entry.photos.length > 0 && (
														<div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
															{entry.photos.map((photo) => (
																<button
																	key={photo}
																	type="button"
																	onClick={() => window.open(photo, "_blank")}
																	className="focus:outline-none focus:ring-2 focus:ring-blue-500 rounded"
																>
																	<img
																		src={photo}
																		alt={photoAltText}
																		className="h-24 w-full rounded object-cover transition-opacity hover:opacity-80"
																	/>
																</button>
															))}
														</div>
													)}
												</div>
											))}
										</div>
									)}
								</div>
							);
						})}
					</motion.section>
				)}
			</motion.main>
		</>
	);
}

