"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import type { BookEntry, Recommendation } from "@/lib/models";
import BookCard from "@/components/BookCard";
import { DateInput } from "@/components/admin/DateTimeInputs";
import {
	TextInput,
	TextArea,
	NumberInput,
	SelectInput,
	CheckboxInput,
} from "@/components/admin/FormInputs";
import { FormActions } from "@/components/admin/FormActions";
import { PageHeader, SectionHeader } from "@/components/admin/PageHeader";
import {
	AdminPageWrapper,
	AdminSection,
} from "@/components/admin/AdminPageWrapper";
import { useAdminCrud } from "@/hooks/useAdminCrud";

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

const STATUS_OPTIONS = [
	{ value: "reading", label: "Reading" },
	{ value: "completed", label: "Completed" },
	{ value: "want-to-read", label: "Want to read" },
];

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
		.replace(/&copy;/g, "©");
}

export default function AdminBooksPage() {
	const [query, setQuery] = useState("");
	const [searchResults, setSearchResults] = useState<GoogleBooksResult[]>([]);
	const [searching, setSearching] = useState(false);
	const [selectedBook, setSelectedBook] = useState<GoogleBooksResult | null>(
		null,
	);
	const [debounceTimer, setDebounceTimer] = useState<NodeJS.Timeout | null>(
		null,
	);

	const [form, setForm] = useState<FormState>(INITIAL_FORM_STATE);
	const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
	const [acceptedRecId, setAcceptedRecId] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	const {
		items: books,
		saving,
		loadAll: loadBooks,
		save: saveBook,
		remove: deleteBook,
	} = useAdminCrud<BookEntry>({
		endpoint: "/api/books",
		entityName: "book",
	});

	useEffect(() => {
		Promise.all([loadBooks(), loadRecommendations()]).finally(() =>
			setLoading(false),
		);
	}, [loadBooks]);

	useEffect(() => {
		return () => {
			if (debounceTimer) {
				clearTimeout(debounceTimer);
			}
		};
	}, [debounceTimer]);

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
				const res = await fetch(
					`https://www.googleapis.com/books/v1/volumes/${rec.googleBooksId}`,
				);
				const data = await res.json();

				if (data.volumeInfo) {
					const info = data.volumeInfo;
					const isbnId = info.industryIdentifiers?.find(
						(id: { type: string; identifier: string }) =>
							id.type === "ISBN_13" || id.type === "ISBN_10",
					);

					bookDetails = {
						...bookDetails,
						title: info.title,
						author: info.authors?.join(", ") || bookDetails.author,
						isbn: isbnId?.identifier || "",
						coverUrl: info.imageLinks?.thumbnail || bookDetails.coverUrl,
						description: info.description
							? stripHtmlTags(info.description)
							: "",
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
		window.scrollTo({ top: 0, behavior: "smooth" });
		toast.info("Recommendation loaded! Review before adding.");
	}

	async function deleteRecommendation(id: string) {
		if (!confirm("Are you sure you want to delete this recommendation?"))
			return;

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

	async function handleSaveBook() {
		if (!form.title || !form.author || !form.dateStarted) {
			toast.error("Please fill in title, author, and date started");
			return;
		}

		const bookData: BookEntry = {
			id: form.id || crypto.randomUUID(),
			title: form.title,
			author: form.author,
			isbn: form.isbn || undefined,
			coverUrl: form.coverUrl || undefined,
			description: form.description || undefined,
			categories: form.categories.length > 0 ? form.categories : undefined,
			progress:
				form.status === "reading" && form.progress > 0
					? form.progress
					: undefined,
			status: form.status,
			dateStarted: form.dateStarted,
			dateCompleted: form.dateCompleted || undefined,
			notes: form.notes || undefined,
			isCurrent: form.isCurrent ? true : undefined,
		};

		const id = await saveBook(bookData);
		if (id) {
			// Clean up recommendation if this was from one
			if (acceptedRecId) {
				try {
					await fetch(`/api/recommend?id=${acceptedRecId}`, {
						method: "DELETE",
					});
					setAcceptedRecId(null);
				} catch (err) {
					console.error("Failed to cleanup recommendation:", err);
					toast.error(
						"Book saved, but failed to remove recommendation. Please delete it manually.",
					);
				}
			}

			await Promise.all([loadBooks(), loadRecommendations()]);
			resetForm();
		}
	}

	async function handleDeleteBook(bookId: string) {
		const success = await deleteBook(bookId);
		if (success) {
			await loadBooks();
			if (form.id === bookId) {
				resetForm();
			}
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
			<AdminPageWrapper>
				<p className="text-zinc-600 dark:text-zinc-400">Loading...</p>
			</AdminPageWrapper>
		);
	}

	return (
		<AdminPageWrapper>
			<PageHeader
				title="Manage Books"
				description="Track your reading journey. Current book appears on your landing page."
			/>

			<AdminSection className="space-y-8">
				<div className="space-y-4">
					<SectionHeader title={isEditing ? "Edit Book" : "Add New Book"} />

					<div>
						<label
							htmlFor="book-search"
							className="mb-2 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
						>
							Search
						</label>
						<input
							id="book-search"
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
						<TextInput
							label="Title"
							value={form.title}
							onChange={(value) => updateForm({ title: value })}
							placeholder="Book title"
						/>
						<TextInput
							label="Author"
							value={form.author}
							onChange={(value) => updateForm({ author: value })}
							placeholder="Author name"
						/>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<TextInput
							label="ISBN (optional)"
							value={form.isbn}
							onChange={(value) => updateForm({ isbn: value })}
							placeholder="ISBN"
						/>
						<TextInput
							label="Cover URL (optional)"
							value={form.coverUrl}
							onChange={(value) => updateForm({ coverUrl: value })}
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

					<TextArea
						label="Description (optional)"
						value={form.description}
						onChange={(value) => updateForm({ description: value })}
						rows={3}
						placeholder="Book description or summary..."
					/>

					<div>
						<TextInput
							label="Categories (optional, comma-separated)"
							value={form.categories.join(", ")}
							onChange={(value) =>
								updateForm({
									categories: value
										.split(",")
										.map((c) => c.trim())
										.filter(Boolean),
								})
							}
							placeholder="e.g., Fiction, Science, History"
						/>
						{form.categories.length > 0 && (
							<div className="mt-2 flex flex-wrap gap-2">
								{form.categories.map((cat) => (
									<span
										key={cat}
										className="inline-block px-2 py-1 text-xs rounded bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
									>
										{cat}
										<button
											type="button"
											onClick={() => {
												updateForm({
													categories: form.categories.filter((c) => c !== cat),
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
						<DateInput
							label="Date Started"
							value={form.dateStarted}
							onChange={(value) => updateForm({ dateStarted: value })}
							required
						/>
						<DateInput
							label="Date Completed (optional)"
							value={form.dateCompleted}
							onChange={(value) => updateForm({ dateCompleted: value })}
						/>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<div className={form.status === "reading" ? "" : "col-span-2"}>
							<SelectInput
								label="Status"
								value={form.status}
								onChange={(value) =>
									updateForm({
										status: value as "reading" | "completed" | "want-to-read",
									})
								}
								options={STATUS_OPTIONS}
							/>
						</div>

						{form.status === "reading" && (
							<NumberInput
								label="Progress (%) (optional)"
								value={form.progress}
								onChange={(value) =>
									updateForm({
										progress: Math.min(
											100,
											Math.max(0, Number.parseInt(value) || 0),
										),
									})
								}
								min={0}
								max={100}
							/>
						)}
					</div>

					<CheckboxInput
						label="Mark as Currently Reading"
						checked={form.isCurrent}
						onChange={(checked) => updateForm({ isCurrent: checked })}
					/>

					<TextArea
						label="Notes (optional)"
						value={form.notes}
						onChange={(value) => updateForm({ notes: value })}
						rows={3}
						placeholder="Add any thoughts about this book..."
					/>

					<FormActions
						saving={saving}
						isEditing={isEditing}
						onSave={handleSaveBook}
						onCancel={resetForm}
						onDelete={
							isEditing && form.id
								? () => handleDeleteBook(form.id as string)
								: undefined
						}
						disabled={!form.title || !form.author || !form.dateStarted}
						saveLabel="Add"
						saveEditLabel="Update"
					/>
				</div>
			</AdminSection>

			{recommendations.length > 0 && (
				<AdminSection>
					<div className="space-y-4">
						<SectionHeader title="Community Recommendations" />
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
											type="button"
											onClick={() => acceptRecommendation(rec)}
											className="flex-1 rounded-md bg-zinc-900 px-3 py-1.5 text-sm text-white transition-colors hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-200"
										>
											Add to library
										</button>
										<button
											type="button"
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
				</AdminSection>
			)}

			{books.length > 0 && (
				<AdminSection>
					<div className="space-y-4">
						<SectionHeader title="All Books" />
						<div className="space-y-2">
							{books
								.sort((a, b) => {
									const dateA = a.dateCompleted || a.dateStarted;
									const dateB = b.dateCompleted || b.dateStarted;

									if (!dateA || !dateB) {
										return dateA ? -1 : dateB ? 1 : 0;
									}

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
				</AdminSection>
			)}
		</AdminPageWrapper>
	);
}
