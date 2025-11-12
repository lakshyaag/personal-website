"use client";

import type { BookEntry } from "@/lib/books";

interface BookCardProps {
	book: BookEntry;
	onEdit?: (book: BookEntry) => void;
	onSetCurrent?: (bookId: string) => void;
	showSetCurrent?: boolean;
	compact?: boolean;
}

export default function BookCard({
	book,
	onEdit,
	onSetCurrent,
	showSetCurrent = false,
	compact = false,
}: BookCardProps) {
	if (compact) {
		// Landing page style
		return (
			<div className="group relative overflow-hidden rounded-xl border border-zinc-200 bg-gradient-to-br from-zinc-50 to-white p-4 dark:border-zinc-800 dark:from-zinc-900 dark:to-zinc-950">
				{/* Subtle gradient background */}
				<div className="absolute inset-0 bg-gradient-to-br from-zinc-100/0 via-zinc-100/5 to-zinc-100/0 dark:from-white/0 dark:via-white/5 dark:to-white/0 pointer-events-none" />

				<div className="relative flex gap-4">
					{/* Book Cover */}
					{book.coverUrl && (
						<div className="flex-shrink-0">
							<img
								src={book.coverUrl}
								alt={book.title}
								className="h-24 w-16 rounded-lg object-cover shadow-md transition-transform duration-300 group-hover:scale-105"
							/>
						</div>
					)}

					{/* Content */}
					<div className="flex-1 min-w-0 flex flex-col justify-between">
						<div>
							<h4 className="font-semibold text-zinc-900 dark:text-zinc-50 line-clamp-2 leading-snug">
								{book.title}
							</h4>
							<p className="text-sm text-zinc-600 dark:text-zinc-400 mt-0.5 truncate">
								{book.author}
							</p>

							{/* Categories */}
							{book.categories && book.categories.length > 0 && (
								<div className="mt-2 flex flex-wrap gap-1">
									{book.categories.slice(0, 2).map((cat, idx) => (
										<span
											key={idx}
											className="text-xs px-2 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400"
										>
											{cat}
										</span>
									))}
									{book.categories.length > 2 && (
										<span className="text-xs px-2 py-1 text-zinc-500 dark:text-zinc-500">
											+{book.categories.length - 2}
										</span>
									)}
								</div>
							)}
						</div>

						{/* Progress Bar */}
						{book.progress > 0 && (
							<div className="mt-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
								<div className="flex items-center justify-between mb-2">
									<span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
										Progress
									</span>
									<span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
										{book.progress}%
									</span>
								</div>
								<div className="w-full h-1 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
									<div
										className="h-full bg-gradient-to-r from-zinc-700 to-zinc-900 dark:from-zinc-300 dark:to-zinc-100 rounded-full transition-all duration-500"
										style={{ width: `${book.progress}%` }}
									/>
								</div>
							</div>
						)}

						{/* Notes */}
						{book.notes && (
							<p className="text-xs text-zinc-500 dark:text-zinc-400 mt-3 line-clamp-2 italic">
								"{book.notes}"
							</p>
						)}
					</div>
				</div>
			</div>
		);
	}

	// Admin page style
	return (
		<div className="rounded-lg border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900/50">
			<div className="flex items-start justify-between gap-4">
				{book.coverUrl && (
					<img
						src={book.coverUrl}
						alt={book.title}
						className="h-24 w-16 rounded object-cover flex-shrink-0"
					/>
				)}
				<div className="flex-1 min-w-0">
					<div className="font-medium dark:text-zinc-100 truncate">
						{book.title}
					</div>
					<div className="text-sm text-zinc-600 dark:text-zinc-400 truncate">
						{book.author}
					</div>
					{book.categories && book.categories.length > 0 && (
						<div className="mt-1 flex flex-wrap gap-1">
							{book.categories.map((cat, idx) => (
								<span
									key={idx}
									className="text-xs px-2 py-0.5 rounded bg-zinc-100 dark:bg-zinc-800 dark:text-zinc-300"
								>
									{cat}
								</span>
							))}
						</div>
					)}
					<div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
						{book.dateStarted}
						{book.dateCompleted && ` → ${book.dateCompleted}`}
					</div>
					{book.notes && (
						<p className="text-xs text-zinc-600 dark:text-zinc-400 mt-2 line-clamp-2">
							{book.notes}
						</p>
					)}
					<div className="mt-2 flex gap-2">
						<span className="inline-block px-2 py-1 text-xs rounded bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300">
							{book.status === "completed"
								? `Finished (${book.progress}%)`
								: `${book.progress}%`}
						</span>
					</div>
				</div>
				<div className="flex flex-col gap-2 flex-shrink-0">
					{onEdit && (
						<button
							type="button"
							onClick={() => onEdit(book)}
							className="px-3 py-1.5 text-xs font-medium rounded-md border border-zinc-300 text-zinc-700 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-300 dark:hover:bg-zinc-700 whitespace-nowrap"
						>
							Edit
						</button>
					)}
					{showSetCurrent && !book.isCurrent && onSetCurrent && (
						<button
							type="button"
							onClick={() => onSetCurrent(book.id)}
							className="px-3 py-1.5 text-xs font-medium rounded-md border border-green-300 text-green-700 transition-colors hover:bg-green-50 dark:border-green-700 dark:text-green-400 dark:hover:bg-green-950 whitespace-nowrap"
						>
							Set as Current
						</button>
					)}
				</div>
			</div>
		</div>
	);
}
