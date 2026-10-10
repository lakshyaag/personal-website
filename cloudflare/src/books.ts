import type {
	Book,
	CreateRecommendationInput,
	Recommendation,
	SaveBookInput,
} from "../../shared/books";
import {
	ApiError,
	type Env,
	jsonColumn,
	now,
	optional,
	statement,
} from "./http";

interface BookRow {
	id: string;
	title: string;
	author: string;
	isbn: string | null;
	cover_url: string | null;
	description: string | null;
	categories: string;
	progress: number | null;
	status: Book["status"];
	date_started: string;
	date_completed: string | null;
	notes: string | null;
	is_current: number;
}
const bookDto = (row: BookRow): Book => {
	const categories = jsonColumn<string[]>(row.categories, []);
	return {
		id: row.id,
		title: row.title,
		author: row.author,
		isbn: optional(row.isbn),
		coverUrl: optional(row.cover_url),
		description: optional(row.description),
		categories: categories.length ? categories : undefined,
		progress: optional(row.progress),
		status: row.status,
		dateStarted: row.date_started,
		dateCompleted: optional(row.date_completed),
		notes: optional(row.notes),
		isCurrent: row.is_current === 1,
	};
};
export async function listBooks(env: Env) {
	const { results } = await statement(
		env,
		"SELECT * FROM books ORDER BY date_started DESC, created_at DESC, id",
	).all<BookRow>();
	return { books: results.map(bookDto) };
}
async function getBook(env: Env, id: string) {
	const row = await statement(
		env,
		"SELECT * FROM books WHERE id = ?",
		id,
	).first<BookRow>();
	if (!row) throw new ApiError(404, "NOT_FOUND", "Book not found");
	return bookDto(row);
}
const clearCurrent = (env: Env, exceptId: string) =>
	statement(
		env,
		"UPDATE books SET is_current = 0 WHERE is_current = 1 AND id != ?",
		exceptId,
	);
export async function saveBook(env: Env, id: string, input: SaveBookInput) {
	const timestamp = now();
	const current = input.isCurrent ?? false;
	await env.DB.batch([
		...(current ? [clearCurrent(env, id)] : []),
		statement(
			env,
			`INSERT INTO books (id,title,author,isbn,cover_url,description,categories,progress,status,date_started,
			date_completed,notes,is_current,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
			ON CONFLICT(id) DO UPDATE SET title=excluded.title,author=excluded.author,isbn=excluded.isbn,
			cover_url=excluded.cover_url,description=excluded.description,categories=excluded.categories,
			progress=excluded.progress,status=excluded.status,date_started=excluded.date_started,
			date_completed=excluded.date_completed,notes=excluded.notes,is_current=excluded.is_current,
			updated_at=excluded.updated_at`,
			id,
			input.title,
			input.author,
			input.isbn ?? null,
			input.coverUrl ?? null,
			input.description ?? null,
			JSON.stringify(input.categories ?? []),
			input.progress ?? null,
			input.status,
			input.dateStarted,
			input.dateCompleted ?? null,
			input.notes ?? null,
			Number(current),
			timestamp,
			timestamp,
		),
	]);
	return getBook(env, id);
}
export async function setCurrentBook(env: Env, id: string) {
	await getBook(env, id);
	await env.DB.batch([
		clearCurrent(env, id),
		statement(
			env,
			"UPDATE books SET is_current = 1, updated_at = ? WHERE id = ?",
			now(),
			id,
		),
	]);
	return getBook(env, id);
}
export async function deleteBook(env: Env, id: string) {
	const removed = await statement(
		env,
		"DELETE FROM books WHERE id = ?",
		id,
	).run();
	if (!removed.meta.changes)
		throw new ApiError(404, "NOT_FOUND", "Book not found");
}

interface RecommendationRow {
	id: string;
	book_name: string;
	book_author: string | null;
	book_cover_url: string | null;
	google_books_id: string | null;
	recommender_name: string | null;
	comment: string | null;
	created_at: string;
}
const recommendationDto = (row: RecommendationRow): Recommendation => ({
	id: row.id,
	bookName: row.book_name,
	bookAuthor: optional(row.book_author),
	bookCoverUrl: optional(row.book_cover_url),
	googleBooksId: optional(row.google_books_id),
	recommenderName: optional(row.recommender_name),
	comment: optional(row.comment),
	timestamp: new Date(row.created_at).getTime(),
});
export async function listRecommendations(env: Env) {
	const { results } = await statement(
		env,
		"SELECT * FROM recommendations ORDER BY created_at DESC, id LIMIT 500",
	).all<RecommendationRow>();
	return { recommendations: results.map(recommendationDto) };
}
export async function createRecommendation(
	env: Env,
	input: CreateRecommendationInput,
) {
	const id = crypto.randomUUID();
	await statement(
		env,
		`INSERT INTO recommendations (id,book_name,book_author,book_cover_url,google_books_id,recommender_name,comment,created_at)
		VALUES (?,?,?,?,?,?,?,?)`,
		id,
		input.bookName,
		input.bookAuthor ?? null,
		input.bookCoverUrl ?? null,
		input.googleBooksId ?? null,
		input.recommenderName ?? null,
		input.comment ?? null,
		now(),
	).run();
	return { id };
}
export async function deleteRecommendation(env: Env, id: string) {
	const removed = await statement(
		env,
		"DELETE FROM recommendations WHERE id = ?",
		id,
	).run();
	if (!removed.meta.changes)
		throw new ApiError(404, "NOT_FOUND", "Recommendation not found");
}
