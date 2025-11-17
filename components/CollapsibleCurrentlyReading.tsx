"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import type { BookEntry } from "@/lib/books";
import BookCard from "./BookCard";
import Link from "next/link";
import { SvgArrowRight } from "@/components/ui/svg-arrow-right";

export default function CollapsibleCurrentlyReading() {
	const [book, setBook] = useState<BookEntry | null>(null);
	const [loading, setLoading] = useState(true);
	const [isOpen, setIsOpen] = useState(false);

	useEffect(() => {
		async function loadBook() {
			try {
				const res = await fetch("/api/books");
				const books = await res.json();
				const currentBook = books.find((b: any) => b.isCurrent) || null;
				setBook(currentBook);
			} catch (error) {
				console.error("Failed to load book:", error);
			} finally {
				setLoading(false);
			}
		}

		loadBook();
	}, []);

	if (loading || !book) {
		return null;
	}

	return (
		<motion.div
			layout
			className="overflow-hidden rounded-lg border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900/50"
		>
			<button
				onClick={() => setIsOpen(!isOpen)}
				className="w-full text-left p-4 transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-900"
			>
				<div className="flex items-center justify-between gap-4">
					<div className="flex-1 min-w-0">
						<p className="text-sm text-zinc-600 dark:text-zinc-400">
							<span className="text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
								Currently Reading:{" "}
							</span>
							<span className="font-semibold text-zinc-900 dark:text-zinc-50">
								{book.title}
							</span>
							{" — "}
							<span className="text-zinc-600 dark:text-zinc-400">
								{book.author}
							</span>
						</p>
					</div>
					<motion.svg
						animate={{ rotate: isOpen ? 180 : 0 }}
						transition={{ duration: 0.2 }}
						className="flex-shrink-0 w-4 h-4 text-zinc-600 dark:text-zinc-400"
						fill="none"
						stroke="currentColor"
						viewBox="0 0 24 24"
					>
						<path
							strokeLinecap="round"
							strokeLinejoin="round"
							strokeWidth={2}
							d="M19 14l-7 7m0 0l-7-7m7 7V3"
						/>
					</motion.svg>
				</div>
			</button>

			<motion.div
				initial={{ height: 0, opacity: 0 }}
				animate={{
					height: isOpen ? "auto" : 0,
					opacity: isOpen ? 1 : 0,
				}}
				transition={{ duration: 0.3 }}
				className="overflow-hidden border-t border-zinc-300 dark:border-zinc-700"
			>
				<div className="p-4 space-y-4">
					<BookCard book={book} compact />
					<Link
						href="/bookshelf"
						className="font-base group relative inline-flex items-center gap-[1px] font-[450] text-zinc-900 dark:text-zinc-50 text-sm"
					>
						View full bookshelf
						<SvgArrowRight
							link="/bookshelf"
							className="opacity-0 transition-opacity duration-200 group-hover:opacity-100"
						/>
					</Link>
				</div>
			</motion.div>
		</motion.div>
	);
}
