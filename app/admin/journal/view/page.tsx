"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import Link from "next/link";
import type { JournalEntry } from "@/lib/models";
import {
	VARIANTS_CONTAINER,
	VARIANTS_SECTION,
	TRANSITION_SECTION,
} from "@/lib/utils";
import { toast } from "sonner";

export default function JournalViewPage() {
	const [groupedEntries, setGroupedEntries] = useState<
		Record<string, JournalEntry[]>
	>({});
	const [loading, setLoading] = useState(true);
	const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());

	useEffect(() => {
		loadEntries();
	}, []);

	async function loadEntries() {
		try {
			const res = await fetch("/api/journal?grouped=true");
			const data = await res.json();
			setGroupedEntries(data);
			// Expand the most recent 3 dates by default
			const dates = Object.keys(data).slice(0, 3);
			setExpandedDates(new Set(dates));
		} catch (err) {
			console.error("Failed to load journal entries:", err);
		} finally {
			setLoading(false);
		}
	}

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
		if (!confirm("Are you sure you want to delete this entry?")) return;

		try {
			const res = await fetch(`/api/journal?id=${entryId}`, {
				method: "DELETE",
			});

			if (!res.ok) throw new Error("Delete failed");

			toast.success("Entry deleted successfully!");
			await loadEntries();
		} catch (err) {
			console.error("Delete error:", err);
			toast.error("Failed to delete entry");
		}
	}

	function formatDate(dateStr: string): string {
		// Parse date string as local date (YYYY-MM-DD format)
		const [year, month, day] = dateStr.split("-").map(Number);
		const date = new Date(year, month - 1, day);
		return date.toLocaleDateString("en-US", {
			weekday: "long",
			year: "numeric",
			month: "long",
			day: "numeric",
		});
	}

	function formatTime(isoString: string): string {
		const date = new Date(isoString);
		return date.toLocaleTimeString("en-US", {
			hour: "numeric",
			minute: "2-digit",
			hour12: true,
		});
	}

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

	const sortedDates = Object.keys(groupedEntries).sort((a, b) =>
		b.localeCompare(a),
	);
	const totalEntries = Object.values(groupedEntries).reduce(
		(sum, entries) => sum + entries.length,
		0,
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
					<p className="text-center text-zinc-600 dark:text-zinc-400">
						Loading entries...
					</p>
				</motion.section>
			</motion.main>
		);
	}

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
				<div className="flex items-center justify-between mb-4">
					<h1 className="text-3xl font-medium">Journal Entries</h1>
					<Link
						href="/admin/journal"
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
					<div className="text-center py-12">
						<p className="text-zinc-600 dark:text-zinc-400 mb-4">
							No journal entries yet.
						</p>
						<Link
							href="/admin/journal"
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
								className="rounded-lg border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900/50 overflow-hidden"
							>
								<button
									type="button"
									onClick={() => toggleDate(date)}
									className="w-full p-4 text-left hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
								>
									<div className="flex items-center justify-between">
										<div>
											<div className="font-medium text-lg">
												{formatDate(date)}
												{relativeDate && (
													<span className="ml-2 text-sm text-zinc-500 dark:text-zinc-500">
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
									<div className="border-t border-zinc-200 dark:border-zinc-800 p-4 space-y-3">
										{entries.map((entry) => (
											<div
												key={entry.id}
												className="rounded-lg border border-zinc-200 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-900"
											>
												<div className="flex items-start justify-between mb-2">
													<div className="text-xs text-zinc-500 dark:text-zinc-500">
														{formatTime(entry.createdAt)}
													</div>
													<div className="flex gap-2">
														<Link
															href={`/admin/journal?edit=${entry.id}`}
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

												{entry.content && (
													<div className="text-sm text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap mb-3">
														{entry.content}
													</div>
												)}

												{entry.photos && entry.photos.length > 0 && (
													<div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4">
														{entry.photos.map((photo) => (
															<img
																key={photo}
																src={photo}
																alt="Journal"
																className="h-24 w-full rounded object-cover cursor-pointer hover:opacity-80 transition-opacity"
																onClick={() => window.open(photo, "_blank")}
															/>
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
	);
}
