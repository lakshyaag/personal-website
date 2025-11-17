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

	const filteredBooks =
		filter === "all"
			? books
			: books.filter((book) => book.status === filter);

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
								className={`px-3 py-1.5 rounded-md font-medium transition-colors ${
									filter === key
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
						<div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-6">
							{filteredBooks.map((book) => (
								<motion.div
									key={book.id}
									layout
									className="group cursor-pointer"
									onClick={() => setSelectedBook(book)}
								>
									{/* Book Cover */}
									<div className="relative aspect-[2/3] mb-3 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800">
										{book.coverUrl ? (
											<img
												src={book.coverUrl}
												alt={`${book.title} cover`}
												className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
											/>
										) : (
											<div className="w-full h-full flex items-center justify-center">
												<BookOpen className="w-12 h-12 text-zinc-400 dark:text-zinc-600" />
											</div>
										)}

										{/* Progress Bar (for reading books) */}
										{book.status === "reading" && book.progress > 0 && (
											<div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-900/20 dark:bg-zinc-100/20">
												<div
													className="h-full bg-zinc-900 dark:bg-zinc-100"
													style={{ width: `${book.progress}%` }}
												/>
											</div>
										)}
									</div>

									{/* Book Info */}
									<div className="space-y-1">
										<h4 className="font-medium text-sm text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-tight">
											{book.title}
										</h4>
										<p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-1">
											{book.author}
										</p>
										{book.status === "reading" && book.progress > 0 && (
											<p className="text-xs text-zinc-500 dark:text-zinc-500">
												{book.progress}%
											</p>
										)}
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
							className="fixed right-0 top-0 bottom-0 w-full sm:w-[500px] bg-white dark:bg-zinc-900 shadow-2xl z-50 overflow-y-auto"
						>
							<div className="p-6 space-y-6">
								{/* Close Button */}
								<button
									onClick={() => setSelectedBook(null)}
									className="absolute top-4 right-4 p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
								>
									<X className="w-5 h-5 text-zinc-600 dark:text-zinc-400" />
								</button>

								{/* Book Cover */}
								<div className="flex justify-center">
									<div className="relative w-48 aspect-[2/3] rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 shadow-lg">
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
								<div className="space-y-4">
									<div>
										<h2 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
											{selectedBook.title}
										</h2>
										<p className="text-lg text-zinc-600 dark:text-zinc-400 mt-1">
											{selectedBook.author}
										</p>
									</div>

									{/* Categories */}
									{selectedBook.categories &&
										selectedBook.categories.length > 0 && (
											<div>
												<h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">
													Categories
												</h3>
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
											</div>
										)}

									{/* Status & Progress */}
									<div>
										<h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">
											Status
										</h3>
										<div className="flex items-center gap-3">
											<span className="text-sm px-3 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 capitalize">
												{selectedBook.status.replace("-", " ")}
											</span>
											{selectedBook.status === "reading" &&
												selectedBook.progress > 0 && (
													<span className="text-sm text-zinc-600 dark:text-zinc-400">
														{selectedBook.progress}% complete
													</span>
												)}
										</div>
										{selectedBook.status === "reading" &&
											selectedBook.progress > 0 && (
												<div className="mt-3 w-full h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
													<div
														className="h-full bg-zinc-900 dark:bg-zinc-100 transition-all"
														style={{ width: `${selectedBook.progress}%` }}
													/>
												</div>
											)}
									</div>

									{/* Dates */}
									<div>
										<h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">
											Timeline
										</h3>
										<div className="text-sm text-zinc-600 dark:text-zinc-400 space-y-1">
											{selectedBook.dateStarted && (
												<p>Started: {selectedBook.dateStarted}</p>
											)}
											{selectedBook.dateCompleted && (
												<p>Completed: {selectedBook.dateCompleted}</p>
											)}
										</div>
									</div>

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

									{/* Notes */}
									{selectedBook.notes && (
										<div>
											<h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">
												My Notes
											</h3>
											<div className="bg-zinc-50 dark:bg-zinc-800/50 rounded-lg p-4 border border-zinc-200 dark:border-zinc-700">
												<p className="text-sm text-zinc-700 dark:text-zinc-300 italic leading-relaxed">
													"{selectedBook.notes}"
												</p>
											</div>
										</div>
									)}

									{/* ISBN */}
									{selectedBook.isbn && (
										<div>
											<h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">
												ISBN
											</h3>
											<p className="text-sm text-zinc-600 dark:text-zinc-400 font-mono">
												{selectedBook.isbn}
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
