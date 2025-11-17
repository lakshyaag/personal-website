"use client";

import { useEffect, useState } from "react";
import { BookEntry } from "@/lib/books";
import { motion } from "motion/react";
import { BookOpen } from "lucide-react";
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
						<p className="text-zinc-600 dark:text-zinc-400">Loading books...</p>
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
								className="group"
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
									{book.notes && (
										<p className="text-xs text-zinc-500 dark:text-zinc-500 italic line-clamp-2 pt-1">
											"{book.notes}"
										</p>
									)}
								</div>
							</motion.div>
						))}
					</div>
				)}
			</motion.section>
		</motion.main>
	);
}
