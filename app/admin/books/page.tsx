"use client";

import { useState, useEffect } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import type { BookEntry, Recommendation } from "@/lib/models";
import BookCard from "@/components/BookCard";
import {
	VARIANTS_CONTAINER,
	VARIANTS_SECTION,
	TRANSITION_SECTION,
} from "@/lib/utils";
import { useConfirmDialog } from "@/components/ui/confirm-dialog";
import { FormInput, FormDateInput, FormTextarea, FormSelect, FormCheckbox, FormNumberInput } from "@/components/admin/form-fields";
import { EmptyState, LoadingText } from "@/components/admin/loading-states";

interface GoogleBooksResult {
	id: string;
	volumeInfo: {
		title: string;
		authors?: string[];
		description?: string;
		categories?: string[];
		imageLinks?: {
			thumbnail?: string;
		};
		industryIdentifiers?: Array<{
			type: string;
			identifier: string;
		}>;
	};
}

interface FormState {
	id?: string;
	title: string;
	author: string;
	isbn: string;
	coverUrl: string;
	description: string;
	categories: string[];
	progress: number;
	status: "reading" | "completed" | "want-to-read";
	dateStarted: string;
	dateCompleted: string;
	notes: string;
	isCurrent: boolean;
}

const INITIAL_FORM_STATE: FormState = {
	title: "",
	author: "",
	isbn: "",
	coverUrl: "",
	description: "",
	categories: [],
	progress: 0,
	status: "reading",
	dateStarted: "",
	dateCompleted: "",
	notes: "",
	isCurrent: false,
};

function stripHtmlTags(html: string): string {
	return html
		.replace(/<br>/g, "\n")
		.replace(/<[^>]*>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'")
		.replace(/&copy;/g, "©")
}

export default function AdminBooksPage() {
	const { ConfirmDialog, confirm } = useConfirmDialog();

	const [query, setQuery] = useState("");
	const [searchResults, setSearchResults] = useState<GoogleBooksResult[]>([]);
	const [searching, setSearching] = useState(false);
	const [selectedBook, setSelectedBook] = useState<GoogleBooksResult | null>(null);
	const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(null);

	const [form, setForm] = useState<FormState>(INITIAL_FORM_STATE);
	const [books, setBooks] = useState<BookEntry[]>([]);
	const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
	const [acceptedRecId, setAcceptedRecId] = useState<string | null>(null);
	const [saving, setSaving] = useState(false);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		Promise.all([loadBooks(), loadRecommendations()]).finally(() => setLoading(false));
	}, []);

	useEffect(() => {
		return () => {
			if (debounceTimer) {
				clearTimeout(debounceTimer);
			}
		};
	}, [debounceTimer]);

	async function loadBooks() {
		try {
			const res = await fetch("/api/books");
			const data = await res.json();
			setBooks(data);
		} catch (err) {
			console.error("Failed to load books:", err);
		}
	}

	async function loadRecommendations() {
		try {
			const res = await fetch("/api/recommend");
			const data = await res.json();
			setRecommendations(data);
		} catch (err) {
			console.error("Failed to load recommendations:", err);
		}
	}

	function updateForm(updates: Partial<FormState>) {
		setForm((prev) => ({ ...prev, ...updates }));
	}

	function searchBooks(searchQuery: string) {
		if (!searchQuery.trim()) {
			setSearchResults([]);
			return;
		}

		setSearching(true);
		fetch(
			`https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(
				searchQuery,
			)}&maxResults=10`,
		)
			.then((res) => res.json())
			.then((data) => {
				setSearchResults(data.items || []);
				setSearching(false);
			})
			.catch((error) => {
				console.error("Search failed:", error);
				setSearchResults([]);
				setSearching(false);
			});
	}

	function selectBook(book: GoogleBooksResult) {
		setSelectedBook(book);
		const info = book.volumeInfo;

		const isbnId = info.industryIdentifiers?.find(
			(id) => id.type === "ISBN_13" || id.type === "ISBN_10",
		);

		updateForm({
			title: info.title,
			author: info.authors?.join(", ") || "",
			isbn: isbnId?.identifier || "",
			coverUrl: info.imageLinks?.thumbnail || "",
			description: info.description ? stripHtmlTags(info.description) : "",
			categories: info.categories || [],
		});

		setQuery("");
		setSearchResults([]);
	}

	async function acceptRecommendation(rec: Recommendation) {
		setAcceptedRecId(rec.id);

		let bookDetails: Partial<FormState> = {
			title: rec.bookName,
			author: rec.bookAuthor || "",
			coverUrl: rec.bookCoverUrl || "",
			status: "want-to-read",
			dateStarted: new Date().toISOString().split("T")[0],
			notes: `Recommended by ${rec.recommenderName || "Anonymous"}${rec.comment ? `: "${rec.comment}"` : ""}`,
		};

		if (rec.googleBooksId) {
			try {
				toast.loading("Fetching book details...");
				const res = await fetch(`https://www.googleapis.com/books/v1/volumes/${rec.googleBooksId}`);
				const data = await res.json();

				if (data.volumeInfo) {
					const info = data.volumeInfo;
					const isbnId = info.industryIdentifiers?.find(
						(id: { type: string; identifier: string }) => id.type === "ISBN_13" || id.type === "ISBN_10",
					);


					bookDetails = {
						...bookDetails,
						title: info.title,
						author: info.authors?.join(", ") || bookDetails.author,
						isbn: isbnId?.identifier || "",
						coverUrl: info.imageLinks?.thumbnail || bookDetails.coverUrl,
						description: info.description ? stripHtmlTags(info.description) : "",
						categories: info.categories || [],
					};
					toast.success("Full book details loaded!");
				}
			} catch (error) {
				console.error("Failed to fetch Google Books details:", error);
				toast.error("Could not fetch full details, using basic info.");
			} finally {
				toast.dismiss();
			}
		}

		updateForm(bookDetails);

		// Scroll to top to see form
		window.scrollTo({ top: 0, behavior: "smooth" });
		toast.info("Recommendation loaded! Review before adding.");
	}

	async function deleteRecommendation(id: string) {
		const confirmed = await confirm({
			title: "Delete Recommendation?",
			message: "This action cannot be undone.",
			variant: "danger",
			confirmLabel: "Delete",
		});

		if (!confirmed) return;

		try {
			const res = await fetch(`/api/recommend?id=${id}`, {
				method: "DELETE",
			});

			if (!res.ok) throw new Error("Delete failed");

			toast.success("Recommendation deleted");
			await loadRecommendations();
		} catch (err) {
			console.error("Delete error:", err);
			toast.error("Failed to delete recommendation");
		}
	}

	async function saveBook() {
		if (!form.title || !form.author || !form.dateStarted) {
			toast.error("Please fill in title, author, and date started");
			return;
		}

		setSaving(true);
		try {
			const bookData: BookEntry = {
				id: form.id || `book-${Date.now()}`,
				title: form.title,
				author: form.author,
				isbn: form.isbn || undefined,
				coverUrl: form.coverUrl || undefined,
				description: form.description || undefined,
				categories: form.categories.length > 0 ? form.categories : undefined,
				progress: form.status === "reading" && form.progress > 0 ? form.progress : undefined,
				status: form.status,
				dateStarted: form.dateStarted,
				dateCompleted: form.dateCompleted || undefined,
				notes: form.notes || undefined,
				isCurrent: form.isCurrent ? true : undefined,
			};

			const res = await fetch("/api/books", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(bookData),
			});

			if (!res.ok) throw new Error("Save failed");

			// Book saved successfully - now clean up the recommendation if this was from one
			let recommendationCleanupFailed = false;
			if (acceptedRecId) {
				try {
					const delRes = await fetch(`/api/recommend?id=${acceptedRecId}`, {
						method: "DELETE",
					});

					if (!delRes.ok) {
						throw new Error("Failed to delete recommendation");
					}

					setAcceptedRecId(null);
				} catch (delErr) {
					console.error("Failed to cleanup recommendation:", delErr);
					recommendationCleanupFailed = true;
					toast.error("Book saved, but failed to remove recommendation. Please delete it manually.");
				}
			}

			// Wait for books to reload before resetting form
			try {
				await Promise.all([loadBooks(), loadRecommendations()]);
			} catch (loadErr) {
				console.error("Failed to reload data:", loadErr);
				toast.warning("Book saved, but failed to refresh list. Please refresh the page.");
			}

			// Show success message only if everything went well
			if (!recommendationCleanupFailed) {
				toast.success(form.id ? "Book updated successfully!" : "Book added to library!");
			}
			resetForm();
		} catch (err) {
			console.error("Save error:", err);
			toast.error("Failed to save book");
		} finally {
			setSaving(false);
		}
	}

	async function deleteBook(bookId: string) {
		const confirmed = await confirm({
			title: "Delete Book?",
			message: "This action cannot be undone.",
			variant: "danger",
			confirmLabel: "Delete",
		});

		if (!confirmed) return;

		try {
			const res = await fetch(`/api/books?id=${bookId}`, {
				method: "DELETE",
			});

			if (!res.ok) throw new Error("Delete failed");

			toast.success("Book deleted successfully");
			await loadBooks();
			if (form.id === bookId) {
				resetForm();
			}
		} catch (err) {
			console.error("Delete error:", err);
			toast.error("Failed to delete book");
		}
	}

	async function makeCurrentBook(bookId: string) {
		try {
			const res = await fetch("/api/books/reorder", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ bookId }),
			});

			if (!res.ok) throw new Error("Reorder failed");

			await loadBooks();
			toast.success("Book set as current!");
		} catch (err) {
			console.error("Reorder error:", err);
			toast.error("Failed to update book order");
		}
	}

	function editBook(book: BookEntry) {
		setForm({
			id: book.id,
			title: book.title,
			author: book.author,
			isbn: book.isbn || "",
			coverUrl: book.coverUrl || "",
			description: book.description || "",
			categories: book.categories || [],
			progress: book.progress || 0,
			status: book.status,
			dateStarted: book.dateStarted,
			dateCompleted: book.dateCompleted || "",
			notes: book.notes || "",
			isCurrent: book.isCurrent || false,
		});
		setQuery("");
		setSearchResults([]);
		setSelectedBook(null);
		setAcceptedRecId(null);
	}

	function resetForm() {
		setForm(INITIAL_FORM_STATE);
		setQuery("");
		setSearchResults([]);
		setSelectedBook(null);
		setAcceptedRecId(null);
	}

	const isEditing = !!form.id;

	if (loading) {
		return (
			<motion.main
				className="space-y-8 pb-16"
				variants={VARIANTS_CONTAINER}
				initial="hidden"
				animate="visible"
			>
				<LoadingText text="Loading books..." />
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
				<h1 className="mb-4 text-3xl font-medium">Manage Books</h1>
				<p className="text-zinc-600 dark:text-zinc-400">
					Track your reading journey. Current book appears on your landing page.
				</p>
			</motion.section>

			<motion.section
				className="space-y-8"
				variants={VARIANTS_SECTION}
				transition={TRANSITION_SECTION}
			>
				<div className="space-y-4">
					<h2 className="text-xl font-medium">
						{isEditing ? "Edit Book" : "Add New Book"}
					</h2>

					<div>
						<label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
							Search
						</label>
						<input
							className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
							placeholder="Search by title, author, or ISBN..."
							value={query}
							onChange={(e) => {
								const newQuery = e.target.value;
								setQuery(newQuery);

								if (debounceTimer) {
									clearTimeout(debounceTimer);
								}

								if (newQuery.trim()) {
									const timer = setTimeout(() => {
										searchBooks(newQuery);
									}, 300);
									setDebounceTimer(timer);
								} else {
									setSearchResults([]);
								}
							}}
						/>

						{searching && (
							<p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
								Searching...
							</p>
						)}

						{searchResults.length > 0 && (
							<div className="mt-2 max-h-64 overflow-auto rounded-lg border border-zinc-300 dark:border-zinc-700">
								{searchResults.map((book) => (
									<button
										type="button"
										key={book.id}
										className="w-full px-4 py-2 text-left text-sm transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
										onClick={() => selectBook(book)}
									>
										<div className="font-medium dark:text-zinc-100">
											{book.volumeInfo.title}
										</div>
										<div className="text-zinc-600 dark:text-zinc-400">
											{book.volumeInfo.authors?.join(", ") || "Unknown author"}
										</div>
									</button>
								))}
							</div>
						)}

						{selectedBook && (
							<div className="mt-2 rounded-lg bg-zinc-100 px-4 py-2 dark:bg-zinc-900/50">
								<div className="font-medium dark:text-zinc-100">
									Selected: {selectedBook.volumeInfo.title}
								</div>
								<div className="text-sm text-zinc-600 dark:text-zinc-400">
									{selectedBook.volumeInfo.authors?.join(", ") ||
										"Unknown author"}
								</div>
							</div>
						)}
					</div>

					<div className="grid grid-cols-2 gap-4">
						<FormInput
							label="Title"
							value={form.title}
							onChange={(e) => updateForm({ title: e.target.value })}
							placeholder="Book title"
						/>

						<FormInput
							label="Author"
							value={form.author}
							onChange={(e) => updateForm({ author: e.target.value })}
							placeholder="Author name"
						/>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<FormInput
							label="ISBN (optional)"
							value={form.isbn}
							onChange={(e) => updateForm({ isbn: e.target.value })}
							placeholder="ISBN"
						/>

						<FormInput
							label="Cover URL (optional)"
							value={form.coverUrl}
							onChange={(e) => updateForm({ coverUrl: e.target.value })}
							placeholder="https://..."
						/>
					</div>

					{form.coverUrl && (
						<div className="flex justify-center">
							<img
								src={form.coverUrl}
								alt={form.title}
								className="h-40 rounded object-cover"
								onError={() => updateForm({ coverUrl: "" })}
							/>
						</div>
					)}

					<FormTextarea
						label="Description (optional)"
						value={form.description}
						onChange={(e) => updateForm({ description: e.target.value })}
						rows={3}
						placeholder="Book description or summary..."
					/>

					<div>
						<label className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
							Categories (optional, comma-separated)
						</label>
						<input
							className="w-full rounded-lg border border-zinc-300 bg-white px-4 py-2 text-zinc-900 focus:border-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-500/20 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
							value={form.categories.join(", ")}
							onChange={(e) =>
								updateForm({
									categories: e.target.value
										.split(",")
										.map((c) => c.trim())
										.filter(Boolean),
								})
							}
							placeholder="e.g., Fiction, Science, History"
						/>
						{form.categories.length > 0 && (
							<div className="mt-2 flex flex-wrap gap-2">
								{form.categories.map((cat, idx) => (
									<span
										key={idx}
										className="inline-block px-2 py-1 text-xs rounded bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
									>
										{cat}
										<button
											type="button"
											onClick={() => {
												updateForm({
													categories: form.categories.filter((_, i) => i !== idx),
												});
											}}
											className="ml-1 font-bold"
										>
											×
										</button>
									</span>
								))}
							</div>
						)}
					</div>

					<div className="grid grid-cols-2 gap-4">
						<FormDateInput
							label="Date Started"
							value={form.dateStarted}
							onChange={(e) => updateForm({ dateStarted: e.target.value })}
						/>

						<FormDateInput
							label="Date Completed (optional)"
							value={form.dateCompleted}
							onChange={(e) => updateForm({ dateCompleted: e.target.value })}
						/>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div className={form.status === "reading" ? "" : "col-span-2"}>
							<FormSelect
								label="Status"
								value={form.status}
								onChange={(e) =>
									updateForm({
										status: e.target.value as "reading" | "completed" | "want-to-read",
									})
								}
								options={[
									{ value: "reading", label: "Reading" },
									{ value: "completed", label: "Completed" },
									{ value: "want-to-read", label: "Want to read" },
								]}
							/>
						</div>

						{form.status === "reading" && (
							<FormNumberInput
								label="Progress (%) (optional)"
								value={form.progress}
								onChange={(e) =>
									updateForm({
										progress: Math.min(100, Math.max(0, parseInt(e.target.value) || 0)),
									})
								}
								min={0}
								max={100}
							/>
						)}
					</div>

					<FormCheckbox
						label="Mark as Currently Reading"
						checked={form.isCurrent}
						onChange={(e) => updateForm({ isCurrent: e.target.checked })}
					/>

					<FormTextarea
						label="Notes (optional)"
						value={form.notes}
						onChange={(e) => updateForm({ notes: e.target.value })}
						rows={3}
						placeholder="Add any thoughts about this book..."
					/>

					<div className="flex gap-2">
						<button
							type="button"
							onClick={saveBook}
							disabled={saving || !form.title || !form.author || !form.dateStarted}
							className="flex-1 rounded-lg bg-zinc-900 px-4 py-2 text-white transition-colors hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
						>
							{saving ? "Saving..." : isEditing ? "Update" : "Add"}
						</button>

						{isEditing && (
							<>
								<button
									type="button"
									onClick={() => deleteBook(form.id!)}
									className="rounded-lg border border-red-300 px-4 py-2 text-red-600 transition-colors hover:bg-red-50 dark:border-red-700 dark:text-red-400 dark:hover:bg-red-950"
								>
									Delete
								</button>
								<button
									type="button"
									onClick={resetForm}
									className="rounded-lg border border-zinc-300 px-4 py-2 transition-colors hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
								>
									Cancel
								</button>
							</>
						)}
					</div>
				</div>
			</motion.section>

			{recommendations.length > 0 && (
				<motion.section
					variants={VARIANTS_SECTION}
					transition={TRANSITION_SECTION}
				>
					<div className="space-y-4">
						<h2 className="text-xl font-medium">Community Recommendations</h2>
						<div className="grid gap-4 md:grid-cols-2">
							{recommendations.map((rec) => (
								<div
									key={rec.id}
									className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900/50"
								>
									<div className="flex gap-4">
										{rec.bookCoverUrl && (
											<img
												src={rec.bookCoverUrl}
												alt={rec.bookName}
												className="h-24 w-16 rounded object-cover"
											/>
										)}
										<div className="flex-1">
											<h3 className="font-medium dark:text-zinc-100">
												{rec.bookName}
											</h3>
											{rec.bookAuthor && (
												<p className="text-sm text-zinc-500 dark:text-zinc-400">
													{rec.bookAuthor}
												</p>
											)}
											<div className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
												<p>
													<span className="font-medium">Recommended by:</span>{" "}
													{rec.recommenderName || "Anonymous"}
												</p>
												{rec.comment && (
													<p className="mt-1 italic">"{rec.comment}"</p>
												)}
											</div>
										</div>
									</div>
									<div className="mt-4 flex gap-2">
										<button
											onClick={() => acceptRecommendation(rec)}
											className="flex-1 rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
										>
											Add to library
										</button>
										<button
											onClick={() => deleteRecommendation(rec.id)}
											className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-600 transition-colors hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/50"
										>
											Reject
										</button>
									</div>
								</div>
							))}
						</div>
					</div>
				</motion.section>
			)}

			{books.length > 0 && (
				<motion.section
					variants={VARIANTS_SECTION}
					transition={TRANSITION_SECTION}
				>
					<div className="space-y-4">
						<h2 className="text-xl font-medium">All Books</h2>
						<div className="space-y-2">
							{books
								.sort((a, b) => {
									// Sort by completed date first, then by start date
									const dateA = a.dateCompleted || a.dateStarted;
									const dateB = b.dateCompleted || b.dateStarted;

									if (!dateA || !dateB) {
										// If no dates, put items without dates at the end
										return dateA ? -1 : dateB ? 1 : 0;
									}

									// Sort in descending order (most recent first)
									return new Date(dateB).getTime() - new Date(dateA).getTime();
								})
								.map((book) => (
									<BookCard
										key={book.id}
										book={book}
										onEdit={editBook}
										onSetCurrent={makeCurrentBook}
										showSetCurrent={!book.isCurrent}
									/>
								))}
						</div>
					</div>
				</motion.section>
			)}
		</motion.main>
		</>
	);
}
