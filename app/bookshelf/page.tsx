"use client";

import { useEffect, useState } from "react";
import { BookEntry } from "@/lib/books";
import { motion } from "motion/react";
import { BookOpen, CheckCircle2, Clock } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

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
    <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-white dark:from-zinc-950 dark:to-zinc-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 mb-4 inline-block"
          >
            ← Back to Home
          </Link>
          <h1 className="text-4xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
            My Bookshelf
          </h1>
          <p className="text-zinc-600 dark:text-zinc-400">
            A collection of books I&apos;m reading, have read, and want to read
          </p>
        </div>

        {/* Filter Tabs */}
        <div className="flex flex-wrap gap-2 mb-8">
          {[
            { key: "all" as FilterStatus, label: "All Books", icon: BookOpen },
            { key: "reading" as FilterStatus, label: "Reading", icon: Clock },
            {
              key: "completed" as FilterStatus,
              label: "Completed",
              icon: CheckCircle2,
            },
            {
              key: "want-to-read" as FilterStatus,
              label: "Want to Read",
              icon: BookOpen,
            },
          ].map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-4 py-2 rounded-lg font-medium transition-all flex items-center gap-2 ${
                filter === key
                  ? "bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
              <span className="text-xs opacity-75">({statusCounts[key]})</span>
            </button>
          ))}
        </div>

        {/* Loading State */}
        {loading && (
          <div className="text-center py-12">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-zinc-900 dark:border-zinc-100"></div>
            <p className="mt-4 text-zinc-600 dark:text-zinc-400">
              Loading books...
            </p>
          </div>
        )}

        {/* Empty State */}
        {!loading && filteredBooks.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="w-16 h-16 mx-auto text-zinc-400 dark:text-zinc-600 mb-4" />
            <h3 className="text-xl font-medium text-zinc-900 dark:text-zinc-100 mb-2">
              No books found
            </h3>
            <p className="text-zinc-600 dark:text-zinc-400">
              {filter === "all"
                ? "Start adding books to your collection"
                : `No books in "${filter}" status`}
            </p>
          </div>
        )}

        {/* Books Grid */}
        {!loading && filteredBooks.length > 0 && (
          <motion.div
            layout
            className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6"
          >
            {filteredBooks.map((book, index) => (
              <motion.div
                key={book.id}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="group"
              >
                <div className="relative aspect-[2/3] mb-3 rounded-lg overflow-hidden shadow-md hover:shadow-xl transition-shadow bg-zinc-200 dark:bg-zinc-800">
                  {book.coverUrl ? (
                    <Image
                      src={book.coverUrl}
                      alt={`${book.title} cover`}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, (max-width: 1024px) 25vw, 16vw"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <BookOpen className="w-12 h-12 text-zinc-400 dark:text-zinc-600" />
                    </div>
                  )}

                  {/* Status Badge */}
                  <div className="absolute top-2 right-2">
                    {book.status === "reading" && (
                      <div className="bg-blue-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                        Reading
                      </div>
                    )}
                    {book.status === "completed" && (
                      <div className="bg-green-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                        Done
                      </div>
                    )}
                    {book.status === "want-to-read" && (
                      <div className="bg-amber-500 text-white px-2 py-1 rounded-full text-xs font-medium">
                        Want
                      </div>
                    )}
                  </div>

                  {/* Progress Bar (for reading books) */}
                  {book.status === "reading" && book.progress > 0 && (
                    <div className="absolute bottom-0 left-0 right-0 h-1 bg-zinc-900/20 dark:bg-zinc-100/20">
                      <div
                        className="h-full bg-blue-500"
                        style={{ width: `${book.progress}%` }}
                      />
                    </div>
                  )}
                </div>

                {/* Book Info */}
                <div className="space-y-1">
                  <h3 className="font-semibold text-sm text-zinc-900 dark:text-zinc-100 line-clamp-2 leading-tight">
                    {book.title}
                  </h3>
                  <p className="text-xs text-zinc-600 dark:text-zinc-400 line-clamp-1">
                    {book.author}
                  </p>
                  {book.status === "reading" && book.progress > 0 && (
                    <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                      {book.progress}% complete
                    </p>
                  )}
                </div>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>
    </div>
  );
}
