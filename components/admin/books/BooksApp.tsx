"use client";

import { DateInput } from "@/components/admin/DateTimeInputs";
import {
	CheckboxInput,
	NumberInput,
	SelectInput,
	TextArea,
	TextInput,
	fieldClass,
} from "@/components/admin/FormInputs";
import { adminRequest } from "@/components/admin/client";
import {
	AdminPage,
	EditorSheet,
	EmptyState,
	Fab,
	ListStatus,
	RecordCard,
	Segmented,
	message,
	primaryButton,
	secondaryButton,
	useAdminList,
	useUndoDelete,
} from "@/components/admin/kit";
import {
	type Book,
	type Recommendation,
	bookListSchema,
	recommendationListSchema,
} from "@/shared/books";
import { localDate } from "@/shared/common";
import { BookOpen } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

interface GoogleBook {
	id: string;
	volumeInfo: {
		title: string;
		authors?: string[];
		description?: string;
		categories?: string[];
		imageLinks?: { thumbnail?: string };
		industryIdentifiers?: { type: string; identifier: string }[];
	};
}
interface Form {
	title: string;
	author: string;
	isbn: string;
	coverUrl: string;
	description: string;
	/** As typed, comma-separated. */
	categories: string;
	progress: number;
	status: Book["status"];
	dateStarted: string;
	dateCompleted: string;
	notes: string;
	isCurrent: boolean;
}

const parseBooks = (data: unknown) => bookListSchema.parse(data).books;
const parseRecommendations = (data: unknown) =>
	recommendationListSchema.parse(data).recommendations;
const STATUS_OPTIONS = [
	{ value: "reading", label: "Reading" },
	{ value: "completed", label: "Completed" },
	{ value: "want-to-read", label: "Want to read" },
];
const STATUS_LABEL: Record<Book["status"], string> = {
	reading: "Reading",
	completed: "Done",
	"want-to-read": "Want",
};

function stripHtml(html: string) {
	return html
		.replace(/<br>/g, "\n")
		.replace(/<[^>]*>/g, "")
		.replace(/&nbsp;/g, " ")
		.replace(/&amp;/g, "&")
		.replace(/&lt;/g, "<")
		.replace(/&gt;/g, ">")
		.replace(/&quot;/g, '"')
		.replace(/&#39;/g, "'");
}
/** Fields Google Books knows about a volume. */
function fromGoogle(book: GoogleBook): Partial<Form> {
	const info = book.volumeInfo;
	return {
		title: info.title,
		author: info.authors?.join(", ") ?? "",
		isbn:
			info.industryIdentifiers?.find(
				(id) => id.type === "ISBN_13" || id.type === "ISBN_10",
			)?.identifier ?? "",
		coverUrl: info.imageLinks?.thumbnail ?? "",
		description: info.description ? stripHtml(info.description) : "",
		categories: info.categories?.join(", ") ?? "",
	};
}
function toForm(book: Book | null): Form {
	return {
		title: book?.title ?? "",
		author: book?.author ?? "",
		isbn: book?.isbn ?? "",
		coverUrl: book?.coverUrl ?? "",
		description: book?.description ?? "",
		categories: book?.categories?.join(", ") ?? "",
		progress: book?.progress ?? 0,
		status: book?.status ?? "reading",
		dateStarted: book?.dateStarted ?? localDate(),
		dateCompleted: book?.dateCompleted ?? "",
		notes: book?.notes ?? "",
		isCurrent: book?.isCurrent ?? false,
	};
}
const byRecent = (a: Book, b: Book) =>
	(b.dateCompleted || b.dateStarted).localeCompare(
		a.dateCompleted || a.dateStarted,
	);

type Editing =
	| { book: Book | null; from?: undefined }
	| { book: null; from: Recommendation };

export default function BooksApp() {
	const [tab, setTab] = useState<"library" | "requests">("library");
	const books = useAdminList("books", parseBooks);
	const recommendations = useAdminList("recommendations", parseRecommendations);
	const { hidden, remove } = useUndoDelete();
	const [editor, setEditor] = useState<Editing | null>(null);

	const library = books.items
		.filter((book) => !hidden.has(book.id))
		.sort(byRecent);
	const requests = recommendations.items.filter((rec) => !hidden.has(rec.id));
	const list = tab === "library" ? books : recommendations;

	return (
		<AdminPage
			title="Books"
			actions={
				<Segmented
					label="Show"
					value={tab}
					onChange={setTab}
					options={[
						{ value: "library", label: "Library" },
						{
							value: "requests",
							label: requests.length
								? `Requests (${requests.length})`
								: "Requests",
						},
					]}
				/>
			}
		>
			<ListStatus
				loading={list.loading}
				error={list.error}
				onRetry={list.reload}
			/>
			{tab === "library" && !books.loading && !books.error && (
				<div className="space-y-3">
					{library.length === 0 && <EmptyState>No books yet.</EmptyState>}
					{library.map((book) => (
						<RecordCard
							key={book.id}
							label={`Edit ${book.title}`}
							onOpen={() => setEditor({ book })}
						>
							<div className="flex gap-3">
								<Cover url={book.coverUrl} title={book.title} />
								<div className="min-w-0 flex-1">
									<div className="font-medium">{book.title}</div>
									<div className="text-zinc-600 dark:text-zinc-400">
										{book.author}
									</div>
									<div className="mt-2 flex flex-wrap gap-1.5 text-xs">
										<span className="rounded-full bg-zinc-100 px-2 py-0.5 dark:bg-zinc-800">
											{book.status === "reading" && book.progress
												? `${book.progress}%`
												: STATUS_LABEL[book.status]}
										</span>
										{book.isCurrent && (
											<span className="rounded-full bg-blue-100 px-2 py-0.5 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
												On homepage
											</span>
										)}
									</div>
								</div>
							</div>
						</RecordCard>
					))}
				</div>
			)}
			{tab === "requests" &&
				!recommendations.loading &&
				!recommendations.error && (
					<div className="space-y-3">
						{requests.length === 0 && (
							<EmptyState>No recommendations waiting.</EmptyState>
						)}
						{requests.map((rec) => (
							<article
								key={rec.id}
								className="space-y-3 rounded-xl border border-zinc-200 p-4 text-sm dark:border-zinc-800"
							>
								<div className="flex gap-3">
									<Cover url={rec.bookCoverUrl} title={rec.bookName} />
									<div className="min-w-0 flex-1">
										<div className="font-medium">{rec.bookName}</div>
										{rec.bookAuthor && (
											<div className="text-zinc-600 dark:text-zinc-400">
												{rec.bookAuthor}
											</div>
										)}
										<p className="mt-2 text-zinc-600 dark:text-zinc-400">
											From {rec.recommenderName || "Anonymous"}
											{rec.comment && `: “${rec.comment}”`}
										</p>
									</div>
								</div>
								<div className="flex gap-2">
									<button
										type="button"
										className={`flex-1 ${primaryButton}`}
										onClick={() => setEditor({ book: null, from: rec })}
									>
										Add to library
									</button>
									<button
										type="button"
										className={secondaryButton}
										onClick={() =>
											remove(
												rec.id,
												"Recommendation rejected",
												`recommendations/${rec.id}`,
											)
										}
									>
										Reject
									</button>
								</div>
							</article>
						))}
					</div>
				)}
			<Fab label="Add book" onClick={() => setEditor({ book: null })} />
			{editor && (
				<BookEditor
					key={editor.book?.id ?? editor.from?.id ?? "new"}
					editing={editor}
					onClose={() => setEditor(null)}
					onSaved={() => {
						setEditor(null);
						books.reload();
						recommendations.reload();
						setTab("library");
					}}
					onDelete={(book) => {
						setEditor(null);
						remove(book.id, "Book deleted", `books/${book.id}`);
					}}
				/>
			)}
		</AdminPage>
	);
}

function Cover({ url, title }: { url?: string; title: string }) {
	return url ? (
		<img
			src={url}
			alt={`${title} cover`}
			className="h-20 w-14 flex-shrink-0 rounded object-cover"
		/>
	) : (
		<div className="flex h-20 w-14 flex-shrink-0 items-center justify-center rounded bg-zinc-100 dark:bg-zinc-800">
			<BookOpen className="h-5 w-5 text-zinc-400" />
		</div>
	);
}

function BookSearch({ onPick }: { onPick: (book: GoogleBook) => void }) {
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<GoogleBook[]>([]);
	const [searching, setSearching] = useState(false);
	const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
	useEffect(() => () => clearTimeout(timer.current), []);
	function search(value: string) {
		setQuery(value);
		clearTimeout(timer.current);
		if (!value.trim()) return setResults([]);
		timer.current = setTimeout(async () => {
			setSearching(true);
			try {
				const res = await fetch(
					`/api/books/search?q=${encodeURIComponent(value)}&maxResults=10`,
				);
				const data = await res.json();
				if (!res.ok) throw new Error(data.error || "Search failed");
				setResults(data.items ?? []);
			} catch (error) {
				toast.error(message(error, "Book search failed"));
			} finally {
				setSearching(false);
			}
		}, 400);
	}
	return (
		<div>
			<label
				htmlFor="book-search"
				className="mb-1.5 block text-sm font-medium text-zinc-700 dark:text-zinc-300"
			>
				Search Google Books
			</label>
			<input
				id="book-search"
				className={fieldClass}
				placeholder="Title, author or ISBN"
				value={query}
				onChange={(event) => search(event.target.value)}
			/>
			{searching && <p className="mt-2 text-sm text-zinc-500">Searching…</p>}
			{results.length > 0 && (
				<div className="mt-2 max-h-64 overflow-auto rounded-lg border border-zinc-300 dark:border-zinc-700">
					{results.map((book) => (
						<button
							type="button"
							key={book.id}
							className="w-full px-3 py-2.5 text-left text-sm active:bg-zinc-100 dark:active:bg-zinc-800"
							onClick={() => {
								onPick(book);
								setQuery("");
								setResults([]);
							}}
						>
							<div className="font-medium">{book.volumeInfo.title}</div>
							<div className="text-zinc-600 dark:text-zinc-400">
								{book.volumeInfo.authors?.join(", ") || "Unknown author"}
							</div>
						</button>
					))}
				</div>
			)}
		</div>
	);
}

function BookEditor({
	editing,
	onClose,
	onSaved,
	onDelete,
}: {
	editing: Editing;
	onClose: () => void;
	onSaved: () => void;
	onDelete: (book: Book) => void;
}) {
	const { book, from } = editing;
	const [initial] = useState(() => toForm(book));
	const [form, setForm] = useState<Form>(() =>
		from
			? {
					...initial,
					title: from.bookName,
					author: from.bookAuthor ?? "",
					coverUrl: from.bookCoverUrl ?? "",
					status: "want-to-read",
					notes: `Recommended by ${from.recommenderName || "Anonymous"}${from.comment ? `: "${from.comment}"` : ""}`,
				}
			: initial,
	);
	const [saving, setSaving] = useState(false);
	const update = (patch: Partial<Form>) =>
		setForm((current) => ({ ...current, ...patch }));

	// A recommendation picked from Google Books comes with its full details.
	useEffect(() => {
		if (!from?.googleBooksId) return;
		fetch(`/api/books/volumes/${from.googleBooksId}`)
			.then((res) => (res.ok ? res.json() : null))
			.then((data: GoogleBook | null) => {
				if (data?.volumeInfo)
					setForm((current) => ({ ...current, ...fromGoogle(data) }));
			})
			.catch(() => undefined);
	}, [from?.googleBooksId]);

	async function save() {
		setSaving(true);
		try {
			await adminRequest(`books/${book?.id ?? crypto.randomUUID()}`, {
				method: "PUT",
				body: JSON.stringify({
					title: form.title,
					author: form.author,
					isbn: form.isbn || undefined,
					coverUrl: form.coverUrl || undefined,
					description: form.description || undefined,
					categories: form.categories
						.split(",")
						.map((c) => c.trim())
						.filter(Boolean),
					progress:
						form.status === "reading" && form.progress > 0
							? form.progress
							: undefined,
					status: form.status,
					dateStarted: form.dateStarted,
					dateCompleted: form.dateCompleted || undefined,
					notes: form.notes || undefined,
					isCurrent: form.isCurrent,
				}),
			});
			if (from)
				await adminRequest(`recommendations/${from.id}`, {
					method: "DELETE",
				}).catch(() =>
					toast.error("Book saved, but the recommendation is still listed."),
				);
			toast.success(book ? "Book updated" : "Book saved");
			onSaved();
		} catch (error) {
			toast.error(message(error, "Failed to save book"));
			setSaving(false);
		}
	}

	return (
		<EditorSheet
			title={book ? "Edit book" : "Add book"}
			onClose={onClose}
			onSubmit={() => void save()}
			onDelete={book ? () => onDelete(book) : undefined}
			saving={saving}
			dirty={JSON.stringify(form) !== JSON.stringify(initial)}
			canSubmit={Boolean(form.title && form.author && form.dateStarted)}
		>
			<BookSearch onPick={(picked) => update(fromGoogle(picked))} />
			{form.coverUrl && (
				<img
					src={form.coverUrl}
					alt={form.title}
					className="h-32 rounded object-cover"
					onError={() => update({ coverUrl: "" })}
				/>
			)}
			<TextInput
				label="Title"
				value={form.title}
				onChange={(title) => update({ title })}
			/>
			<TextInput
				label="Author"
				value={form.author}
				onChange={(author) => update({ author })}
			/>
			<div className="grid grid-cols-2 gap-3">
				<SelectInput
					label="Status"
					value={form.status}
					onChange={(status) => update({ status: status as Book["status"] })}
					options={STATUS_OPTIONS}
				/>
				{form.status === "reading" && (
					<NumberInput
						label="Progress (%)"
						value={form.progress}
						onChange={(value) =>
							update({
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
			<div className="grid grid-cols-2 gap-3">
				<DateInput
					label="Started"
					value={form.dateStarted}
					onChange={(dateStarted) => update({ dateStarted })}
					required
				/>
				<DateInput
					label="Finished"
					value={form.dateCompleted}
					onChange={(dateCompleted) => update({ dateCompleted })}
				/>
			</div>
			<CheckboxInput
				label="Show on homepage as currently reading"
				checked={form.isCurrent}
				onChange={(isCurrent) => update({ isCurrent })}
			/>
			<TextArea
				label="Notes (optional)"
				value={form.notes}
				onChange={(notes) => update({ notes })}
				rows={3}
			/>
			<details className="space-y-4">
				<summary className="cursor-pointer text-sm font-medium">
					More details
				</summary>
				<div className="space-y-4 pt-3">
					<TextInput
						label="ISBN"
						value={form.isbn}
						onChange={(isbn) => update({ isbn })}
					/>
					<TextInput
						label="Cover URL"
						value={form.coverUrl}
						onChange={(coverUrl) => update({ coverUrl })}
						placeholder="https://…"
					/>
					<TextInput
						label="Categories (comma-separated)"
						value={form.categories}
						onChange={(categories) => update({ categories })}
					/>
					<TextArea
						label="Description"
						value={form.description}
						onChange={(description) => update({ description })}
						rows={4}
					/>
				</div>
			</details>
		</EditorSheet>
	);
}
