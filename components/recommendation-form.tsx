"use client";

import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "motion/react";
import { X, MessageSquarePlus, Search, BookOpen } from "lucide-react";

interface GoogleBooksResult {
    id: string;
    volumeInfo: {
        title: string;
        authors?: string[];
        imageLinks?: {
            thumbnail?: string;
        };
    };
}

export function RecommendationForm() {
    const [isOpen, setIsOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Search state
    const [query, setQuery] = useState("");
    const [searchResults, setSearchResults] = useState<GoogleBooksResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);
    const [selectedBook, setSelectedBook] = useState<GoogleBooksResult | null>(null);

    // Refs for cleanup and race condition handling
    const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const abortControllerRef = useRef<AbortController | null>(null);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
            if (abortControllerRef.current) abortControllerRef.current.abort();
        };
    }, []);

    // Reset state when modal closes
    useEffect(() => {
        if (!isOpen) {
            // Small delay to allow exit animation to finish before clearing content
            const timer = setTimeout(() => {
                setQuery("");
                setSearchResults([]);
                setSelectedBook(null);
                setIsSuccess(false);
                setError(null);
                setIsLoading(false);
            }, 300);
            return () => clearTimeout(timer);
        }
    }, [isOpen]);

    function searchBooks(searchQuery: string) {
        if (!searchQuery.trim()) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }

        // Cancel previous request
        if (abortControllerRef.current) {
            abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();

        setIsSearching(true);

        fetch(
            `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
                searchQuery
            )}&maxResults=5`,
            { signal: abortControllerRef.current.signal }
        )
            .then((res) => res.json())
            .then((data) => {
                setSearchResults(data.items || []);
                setIsSearching(false);
            })
            .catch((error) => {
                if (error.name !== 'AbortError') {
                    console.error("Search failed:", error);
                    setSearchResults([]);
                    setIsSearching(false);
                }
            });
    }

    function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
        const newQuery = e.target.value;
        setQuery(newQuery);

        if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);

        if (newQuery.trim()) {
            debounceTimerRef.current = setTimeout(() => {
                searchBooks(newQuery);
            }, 300);
        } else {
            setSearchResults([]);
            setIsSearching(false);
        }
    }

    function selectBook(book: GoogleBooksResult) {
        setSelectedBook(book);
        setQuery("");
        setSearchResults([]);
    }

    function clearSelection() {
        setSelectedBook(null);
        setQuery("");
    }

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault();
        setIsLoading(true);
        setError(null);
        setIsSuccess(false);

        const formData = new FormData(event.currentTarget);
        const recommenderName = formData.get("recommenderName");
        const comment = formData.get("comment");

        const data = {
            bookName: selectedBook ? selectedBook.volumeInfo.title : (formData.get("bookName") as string),
            bookAuthor: selectedBook?.volumeInfo.authors?.join(", "),
            bookCoverUrl: selectedBook?.volumeInfo.imageLinks?.thumbnail,
            googleBooksId: selectedBook?.id !== 'manual' ? selectedBook?.id : undefined,
            recommenderName: recommenderName as string,
            comment: comment as string,
        };

        try {
            const res = await fetch("/api/recommend", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(data),
            });

            if (!res.ok) {
                throw new Error("Failed to submit recommendation");
            }

            setIsSuccess(true);
            (event.target as HTMLFormElement).reset();

            // Close modal after success
            setTimeout(() => {
                setIsOpen(false);
            }, 2000);
        } catch (err) {
            setError("Something went wrong. Please try again.");
            setIsLoading(false);
        }
    }

    return (
        <>
            <button
                onClick={() => setIsOpen(true)}
                className="px-3 py-1.5 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-full hover:opacity-90 transition-opacity flex items-center gap-2 text-sm font-medium"
            >
                <MessageSquarePlus className="w-4 h-4" />
                <span className="hidden sm:inline">Recommend</span>
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        {createPortal(
                            <>
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    exit={{ opacity: 0 }}
                                    onClick={() => setIsOpen(false)}
                                    className="fixed inset-0 bg-black/50 z-40"
                                />
                                <motion.div
                                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.95, y: 20 }}
                                    className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none"
                                >
                                    <div className="bg-white dark:bg-neutral-900 w-full max-w-md rounded-xl shadow-2xl p-6 pointer-events-auto relative max-h-[90vh] overflow-y-auto">
                                        <button
                                            onClick={() => setIsOpen(false)}
                                            className="absolute top-4 right-4 p-1 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                                        >
                                            <X className="w-5 h-5 text-neutral-500" />
                                        </button>

                                        <h2 className="text-xl font-semibold mb-1">Recommend a Book</h2>
                                        <p className="text-sm text-neutral-500 mb-6">
                                            Share a book for me to read!
                                        </p>

                                        {isSuccess ? (
                                            <div className="p-4 bg-green-50 dark:bg-green-900/20 text-green-600 dark:text-green-400 rounded-md text-center py-8">
                                                <p className="font-medium">Thanks for the recommendation!</p>
                                                <p className="text-sm mt-1">I'll check it out soon.</p>
                                            </div>
                                        ) : (
                                            <form onSubmit={handleSubmit} className="space-y-4">
                                                <div>
                                                    <label
                                                        className="block text-sm font-medium mb-1"
                                                    >
                                                        Book Name <span className="text-red-500">*</span>
                                                    </label>

                                                    {!selectedBook ? (
                                                        <div className="relative">
                                                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                                <Search className="h-4 w-4 text-neutral-400" />
                                                            </div>
                                                            <input
                                                                type="text"
                                                                value={query}
                                                                onChange={handleSearchChange}
                                                                className="w-full pl-10 px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-neutral-500"
                                                                placeholder="Search for a book..."
                                                                autoFocus
                                                            />
                                                            {isSearching && (
                                                                <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                                                                    <div className="animate-spin h-4 w-4 border-2 border-neutral-500 border-t-transparent rounded-full"></div>
                                                                </div>
                                                            )}

                                                            {searchResults.length > 0 && (
                                                                <div className="absolute z-10 w-full mt-1 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 rounded-md shadow-lg max-h-60 overflow-auto">
                                                                    {searchResults.map((book) => (
                                                                        <button
                                                                            key={book.id}
                                                                            type="button"
                                                                            onClick={() => selectBook(book)}
                                                                            className="w-full text-left px-4 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700 flex items-center gap-3"
                                                                        >
                                                                            {book.volumeInfo.imageLinks?.thumbnail ? (
                                                                                <img
                                                                                    src={book.volumeInfo.imageLinks.thumbnail}
                                                                                    alt=""
                                                                                    className="w-8 h-12 object-cover rounded bg-neutral-200"
                                                                                />
                                                                            ) : (
                                                                                <div className="w-8 h-12 bg-neutral-200 dark:bg-neutral-700 rounded flex items-center justify-center">
                                                                                    <BookOpen className="w-4 h-4 text-neutral-400" />
                                                                                </div>
                                                                            )}
                                                                            <div>
                                                                                <div className="font-medium text-sm line-clamp-1">{book.volumeInfo.title}</div>
                                                                                <div className="text-xs text-neutral-500 line-clamp-1">
                                                                                    {book.volumeInfo.authors?.join(", ")}
                                                                                </div>
                                                                            </div>
                                                                        </button>
                                                                    ))}
                                                                </div>
                                                            )}

                                                            {/* Fallback manual input if search doesn't find it */}
                                                            {query && searchResults.length === 0 && !isSearching && (
                                                                <div className="mt-2 text-xs text-neutral-500">
                                                                    Can't find it? <button type="button" onClick={() => setSelectedBook({ id: 'manual', volumeInfo: { title: query } })} className="text-neutral-900 dark:text-neutral-100 underline">Use "{query}"</button>
                                                                </div>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        <div className="flex items-start gap-4 p-3 border border-neutral-200 dark:border-neutral-800 rounded-md bg-neutral-50 dark:bg-neutral-900/50">
                                                            {selectedBook.volumeInfo.imageLinks?.thumbnail ? (
                                                                <img
                                                                    src={selectedBook.volumeInfo.imageLinks.thumbnail}
                                                                    alt={selectedBook.volumeInfo.title}
                                                                    className="w-12 h-16 object-cover rounded shadow-sm"
                                                                />
                                                            ) : (
                                                                <div className="w-12 h-16 bg-neutral-200 dark:bg-neutral-800 rounded flex items-center justify-center">
                                                                    <BookOpen className="w-6 h-6 text-neutral-400" />
                                                                </div>
                                                            )}
                                                            <div className="flex-1 min-w-0">
                                                                <h4 className="font-medium text-sm">{selectedBook.volumeInfo.title}</h4>
                                                                {selectedBook.volumeInfo.authors && (
                                                                    <p className="text-xs text-neutral-500 mt-0.5">{selectedBook.volumeInfo.authors.join(", ")}</p>
                                                                )}
                                                                <button
                                                                    type="button"
                                                                    onClick={clearSelection}
                                                                    className="text-xs text-red-500 hover:text-red-600 mt-2"
                                                                >
                                                                    Change book
                                                                </button>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Hidden input for fallback/validation if needed */}
                                                    <input type="hidden" name="bookName" value={selectedBook?.volumeInfo.title || query} />
                                                </div>

                                                <div>
                                                    <label
                                                        htmlFor="recommenderName"
                                                        className="block text-sm font-medium mb-1"
                                                    >
                                                        Your Name (Optional)
                                                    </label>
                                                    <input
                                                        type="text"
                                                        id="recommenderName"
                                                        name="recommenderName"
                                                        className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-neutral-500"
                                                        placeholder="John Doe"
                                                    />
                                                </div>

                                                <div>
                                                    <label
                                                        htmlFor="comment"
                                                        className="block text-sm font-medium mb-1"
                                                    >
                                                        Why do you recommend it? (Optional)
                                                    </label>
                                                    <textarea
                                                        id="comment"
                                                        name="comment"
                                                        rows={3}
                                                        className="w-full px-3 py-2 border border-neutral-200 dark:border-neutral-800 rounded-md bg-transparent focus:outline-none focus:ring-2 focus:ring-neutral-500"
                                                        placeholder="It changed how I think about..."
                                                    />
                                                </div>

                                                {error && (
                                                    <div className="text-red-500 text-sm">{error}</div>
                                                )}

                                                <button
                                                    type="submit"
                                                    disabled={isLoading || (!selectedBook && !query)}
                                                    className="w-full px-4 py-2 bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900 rounded-md font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
                                                >
                                                    {isLoading ? "Sending..." : "Send Recommendation"}
                                                </button>
                                            </form>
                                        )}
                                    </div>
                                </motion.div>
                            </>,
                            document.body
                        )}
                    </>
                )}
            </AnimatePresence>
        </>
    );
}
