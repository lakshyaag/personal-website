"use client";

import { useEffect, useState } from "react";
import { BookEntry } from "@/lib/books";
import { motion, AnimatePresence } from "motion/react";
import { BookOpen, X } from "lucide-react";
import {
	VARIANTS_CONTAINER,
	VARIANTS_SECTION,
	TRANSITION_SECTION,
} from "@/lib/utils";

type FilterStatus = "all" | "reading" | "completed" | "want-to-read";

function formatDate(dateStr: string): string {
	try {
		const date = new Date(dateStr);
		return date.toLocaleDateString("en-US", {
			month: "short",
			year: "numeric",
		});
	} catch {
		return dateStr;
	}
}

export default function BookshelfPage() {
	const [books, setBooks] = useState<BookEntry[]>([]);
	const [filter, setFilter] = useState<FilterStatus>("all");
	const [loading, setLoading] = useState(true);
	const [selectedBook, setSelectedBook] = useState<BookEntry | null>(null);

	useEffect(() => {
		fetch("/api/books")
			.then((res) => res.json())
			.then((data) => {
				setBooks(data);
				setLoading(false);
			})
			.catch(() => setLoading(false));
	}, []);

	const filteredBooks = (
		filter === "all"
			? books
			: books.filter((book) => book.status === filter)
	).sort((a, b) => {
		// Sort by completed date first, then by start date
		const dateA = a.dateCompleted || a.dateStarted;
		const dateB = b.dateCompleted || b.dateStarted;

		if (!dateA || !dateB) {
			// If no dates, put items without dates at the end
			return dateA ? -1 : dateB ? 1 : 0;
		}

		// Sort in descending order (most recent first)
		return new Date(dateB).getTime() - new Date(dateA).getTime();
	});

	const statusCounts = {
		all: books.length,
		reading: books.filter((b) => b.status === "reading").length,
		completed: books.filter((b) => b.status === "completed").length,
		"want-to-read": books.filter((b) => b.status === "want-to-read").length,
	};

	return (
		<>
			<motion.main
				className="space-y-24"
				variants={VARIANTS_CONTAINER}
				initial="hidden"
				animate="visible"
			>
				<motion.section
					variants={VARIANTS_SECTION}
					transition={TRANSITION_SECTION}
				>
					<div className="flex justify-between items-center mb-5">
						<h3 className="text-lg font-medium">Bookshelf</h3>
					</div>

					{/* Filter Tabs */}
					<div className="flex flex-wrap gap-2 mb-8 text-sm">
						{[
							{ key: "all" as FilterStatus, label: "All" },
							{ key: "reading" as FilterStatus, label: "Reading" },
							{ key: "completed" as FilterStatus, label: "Completed" },
							{ key: "want-to-read" as FilterStatus, label: "Want to Read" },
						].map(({ key, label }) => (
							<button
								key={key}
								onClick={() => setFilter(key)}
								className={`px-3 py-1.5 rounded-md font-medium transition-colors ${filter === key
									? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
									: "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100"
									}`}
							>
								{label} ({statusCounts[key]})
							</button>
						))}
					</div>

					{/* Loading State */}
					{loading && (
						<div className="text-center py-12">
							<p className="text-zinc-600 dark:text-zinc-400">
								Loading books...
							</p>
						</div>
					)}

					{/* Empty State */}
					{!loading && filteredBooks.length === 0 && (
						<div className="text-center py-12">
							<BookOpen className="w-12 h-12 mx-auto text-zinc-400 dark:text-zinc-600 mb-4" />
							<p className="text-zinc-600 dark:text-zinc-400">
								{filter === "all"
									? "No books yet"
									: `No books in "${filter}" status`}
							</p>
						</div>
					)}

					{/* Books Grid */}
					{!loading && filteredBooks.length > 0 && (
						<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-6">
							{filteredBooks.map((book) => (
								<motion.div
									key={book.id}
									layout
									className="group cursor-pointer"
									onClick={() => setSelectedBook(book)}
								>
									{/* Book Cover */}
									<div className="relative aspect-[2/3] mb-2 rounded-md overflow-hidden bg-zinc-100 dark:bg-zinc-800 shadow-sm hover:shadow-md transition-shadow">
										{book.coverUrl ? (
											<img
												src={book.coverUrl}
												alt={`${book.title} cover`}
												className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
											/>
										) : (
											<div className="w-full h-full flex items-center justify-center">
												<BookOpen className="w-8 h-8 sm:w-12 sm:h-12 text-zinc-400 dark:text-zinc-600" />
											</div>
										)}

										{/* Status Badge */}
										<div className="absolute top-2 right-2">
											{book.status === "reading" ? (
												<span className="text-[10px] sm:text-xs font-semibold px-2 py-1 rounded-md bg-blue-600/90 text-white">
													{book.progress}%
												</span>
											) : book.status === "completed" ? (
												<span className="text-[10px] sm:text-xs font-semibold px-2 py-1 rounded-md bg-green-600/90 text-white">
													Done
												</span>
											) : (
												<span className="text-[10px] sm:text-xs font-semibold px-2 py-1 rounded-md bg-gray-600/90 text-white">
													Want
												</span>
											)}
										</div>
									</div>

									{/* Book Info */}
									<div className="space-y-0.5">
										<h4 className="font-medium text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-tight">
											{book.title}
										</h4>
										<p className="text-[10px] sm:text-xs text-zinc-600 dark:text-zinc-400 line-clamp-1">
											{book.author}
										</p>

									</div>
								</motion.div>
							))}
						</div>
					)}
				</motion.section>
			</motion.main>

			{/* Book Detail Drawer */}
			<AnimatePresence>
				{selectedBook && (
					<>
						{/* Backdrop */}
						<motion.div
							initial={{ opacity: 0 }}
							animate={{ opacity: 1 }}
							exit={{ opacity: 0 }}
							onClick={() => setSelectedBook(null)}
							className="fixed inset-0 bg-zinc-900/50 dark:bg-black/70 z-40"
						/>

						{/* Drawer */}
						<motion.div
							initial={{ x: "100%" }}
							animate={{ x: 0 }}
							exit={{ x: "100%" }}
							transition={{ type: "spring", damping: 30, stiffness: 300 }}
							className="fixed right-0 top-0 bottom-0 w-full sm:w-[90vw] sm:max-w-[500px] bg-white dark:bg-zinc-900 shadow-2xl z-50 overflow-y-auto"
						>
							<div className="p-4 sm:p-6 space-y-6">
								{/* Close Button */}
								<button
									onClick={() => setSelectedBook(null)}
									className="absolute top-4 right-4 p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
								>
									<X className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
								</button>

								{/* Book Cover */}
								<div className="flex justify-center pt-4">
									<div className="relative w-40 sm:w-48 aspect-[2/3] rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 shadow-lg">
										{selectedBook.coverUrl ? (
											<img
												src={selectedBook.coverUrl}
												alt={`${selectedBook.title} cover`}
												className="w-full h-full object-cover"
											/>
										) : (
											<div className="w-full h-full flex items-center justify-center">
												<BookOpen className="w-16 h-16 text-zinc-400 dark:text-zinc-600" />
											</div>
										)}
									</div>
								</div>

								{/* Book Details */}
								<div className="space-y-5">
									<div>
										<h2 className="text-xl sm:text-2xl font-bold text-zinc-900 dark:text-zinc-100">
											{selectedBook.title}
										</h2>
										<p className="text-base sm:text-lg text-zinc-600 dark:text-zinc-400 mt-1">
											{selectedBook.author}
										</p>
									</div>

									{/* Categories */}
									{selectedBook.categories &&
										selectedBook.categories.length > 0 && (
											<div className="flex flex-wrap gap-2">
												{selectedBook.categories.map((cat, idx) => (
													<span
														key={idx}
														className="text-xs px-3 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300"
													>
														{cat}
													</span>
												))}
											</div>
										)}

									{/* Status & Progress */}
									<div>
										<div className="flex items-center gap-3">
											<span className="text-sm px-3 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 capitalize">
												{selectedBook.status.replace("-", " ")}
											</span>
											{selectedBook.status === "reading" &&
												selectedBook.progress && selectedBook.progress > 0 && (
													<span className="text-sm text-zinc-600 dark:text-zinc-400">
														{selectedBook.progress}%
													</span>
												)}
										</div>
										{selectedBook.status === "reading" &&
											selectedBook.progress && selectedBook.progress > 0 && (
												<div className="mt-3 w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
													<div
														className="h-full bg-zinc-900 dark:bg-zinc-100 transition-all"
														style={{ width: `${selectedBook.progress}%` }}
													/>
												</div>
											)}
									</div>

									{/* Dates */}
									{(selectedBook.dateCompleted) && (
										<div className="text-sm text-zinc-500 dark:text-zinc-400">
											<span>{formatDate(selectedBook.dateCompleted)}</span>
										</div>
									)}

									{/* Notes */}
									{selectedBook.notes && (
										<div>
											<h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">
												My Notes
											</h3>
											<div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-3 sm:p-4 border border-zinc-200 dark:border-zinc-700">
												<p className="text-sm text-zinc-700 dark:text-zinc-300 italic leading-relaxed">
													"{selectedBook.notes}"
												</p>
											</div>
										</div>
									)}

									{/* Description */}
									{selectedBook.description && (
										<div>
											<h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">
												Description
											</h3>
											<p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
												{selectedBook.description}
											</p>
										</div>
									)}
								</div>
							</div>
						</motion.div>
					</>
				)}
			</AnimatePresence>
		</>
	);
}
