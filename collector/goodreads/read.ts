import { SPOTLIGHT_ELIGIBLE_DAYS } from "@/lib/books/shelf";
import { HOME_KEYS } from "@/lib/home/status";
import { addDays, ownerDay } from "@/lib/owner-day";
import type { HomeBooks, ShelfBook } from "@/types/books";
import { type Database, getMeta, setMeta } from "../db";
import { everyHours, type Job } from "../jobs";
import type { HomeRedis } from "../redis";
import {
	parseProgressList,
	parseTooltip,
	parseWidget,
	type WidgetBook,
} from "./parse";

const GOODREADS = "https://www.goodreads.com";
const FETCH_TIMEOUT_MS = 20_000;
/** The most books one widget returns; it has no paging. */
const WIDGET_BOOKS = 100;
/** Book lookups can be bot-challenged under load: few, and one at a time. */
const LOOKUPS_PER_READ = 10;
const PAUSE_BETWEEN_LOOKUPS_MS = 2000;
/** How many read books are published after the currently-reading ones. */
const READ_BOOKS_PUBLISHED = 20;

const SEEDED_KEY = "goodreads:seeded";
const READ_AT_KEY = "goodreads:read-at";

export interface GoodreadsOptions {
	db: Database;
	/** The owner's numeric Goodreads id */
	userId: string;
	/** The body of a page, rejecting when the request fails */
	fetchText?(url: string): Promise<string>;
	pause?(ms: number): Promise<void>;
}

export async function fetchText(url: string): Promise<string> {
	const response = await fetch(url, {
		headers: { "User-Agent": "Mozilla/5.0 (compatible; trmnl-collector)" },
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
	});
	// A bot challenge is answered 202 with nothing in it
	if (response.status !== 200) {
		throw new Error(
			`Goodreads answered ${response.status} for ${new URL(url).pathname}`,
		);
	}
	return response.text();
}

interface KnownBook {
	shelf: string;
	first_read_on: string | null;
}

function upsertBook(
	db: Database,
	book: WidgetBook,
	shelf: "reading" | "read",
	position: number,
	firstReadOn: string | null,
): void {
	db.prepare(
		`INSERT INTO books (review_id, book_id, title, author, cover_url, stars,
		 shelf, position, first_read_on) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
		 ON CONFLICT (review_id) DO UPDATE SET book_id = excluded.book_id,
		 title = excluded.title, author = excluded.author,
		 cover_url = excluded.cover_url, stars = excluded.stars,
		 shelf = excluded.shelf, position = excluded.position,
		 first_read_on = excluded.first_read_on`,
	).run(
		book.reviewId,
		book.bookId ?? null,
		book.title,
		book.author ?? null,
		book.coverUrl ?? null,
		book.stars ?? null,
		shelf,
		position,
		firstReadOn,
	);
}

/**
 * Read the owner's shelves and progress from Goodreads, with no login, into
 * the record.
 *
 * Goodreads gives no finish date, so a book is Finished on the day its
 * review id is first seen on the read shelf. On the very first read every
 * book already there is recorded with no finish date.
 *
 * The read fails, and changes nothing, when a request errors, when a page
 * is not what was asked for, or when the read shelf had books and now has
 * none. An empty currently-reading shelf is not a failure: its header shows
 * it is the right shelf, and finishing the only book in progress empties it.
 */
export async function readGoodreads(
	options: GoodreadsOptions,
	now: Date,
): Promise<void> {
	const { db, userId } = options;
	const get = options.fetchText ?? fetchText;
	const pause =
		options.pause ??
		((ms: number) => new Promise<void>((done) => setTimeout(done, ms)));

	// The widget is cached on the id and widget_id, ignoring everything else
	// on a hit, so each query has its own, new on every read
	const widgetId = Math.floor(now.getTime() / 1000);
	const widget = (shelf: string, id: number): string =>
		`${GOODREADS}/review/custom_widget/${userId}?shelf=${shelf}&sort=date_read&order=d&num_books=${WIDGET_BOOKS}&widget_id=${id}`;
	const read = parseWidget(await get(widget("read", widgetId)), "read");
	const reading = parseWidget(
		await get(widget("currently-reading", widgetId + 1)),
		"currently-reading",
	);
	const progress = parseProgressList(
		await get(`${GOODREADS}/user_status/list/${userId}`),
		now,
	);

	const known = new Map(
		(
			db
				.prepare("SELECT review_id, shelf, first_read_on FROM books")
				.all() as unknown as (KnownBook & { review_id: string })[]
		).map((row) => [row.review_id, row]),
	);
	const hadReadBooks = [...known.values()].some((row) => row.shelf === "read");
	if (read.length === 0 && hadReadBooks) {
		throw new Error("Goodreads read shelf had books and now has none");
	}

	const seeded = getMeta(db, SEEDED_KEY) !== undefined;
	const today = ownerDay(now);
	db.exec("BEGIN");
	try {
		db.exec("UPDATE books SET position = NULL WHERE shelf = 'read'");
		// New books below every known one at the foot of a full list were
		// pushed into the newest hundred by others leaving the shelf; they
		// were not just read
		const lastKnown = read.findLastIndex((book) => known.has(book.reviewId));
		const pushedInFrom =
			read.length === WIDGET_BOOKS ? lastKnown + 1 : read.length;
		for (const [position, book] of read.entries()) {
			const before = known.get(book.reviewId);
			let firstReadOn: string | null;
			if (before?.shelf === "read") {
				firstReadOn = before.first_read_on;
			} else if (before) {
				// It was on the currently-reading shelf: finished since
				firstReadOn = today;
			} else {
				firstReadOn = seeded && position < pushedInFrom ? today : null;
			}
			upsertBook(db, book, "read", position, firstReadOn);
		}
		const onShelves = new Set(read.map((book) => book.reviewId));
		for (const [position, book] of reading.entries()) {
			// A book on both shelves is read
			if (!onShelves.has(book.reviewId)) {
				upsertBook(
					db,
					book,
					"reading",
					position,
					known.get(book.reviewId)?.first_read_on ?? null,
				);
				onShelves.add(book.reviewId);
			}
		}
		// A book taken off the currently-reading shelf unfinished is gone
		for (const [reviewId, row] of known) {
			if (row.shelf === "reading" && !onShelves.has(reviewId)) {
				db.prepare("DELETE FROM books WHERE review_id = ?").run(reviewId);
			}
		}
		// Newest first: the first update seen for a book is its latest. An
		// update with the same numbers as the one kept is the same update:
		// a time written "3 days ago" must not move it forward on each read
		const latest = new Set<string>();
		for (const update of progress) {
			if (latest.has(update.bookId)) {
				continue;
			}
			latest.add(update.bookId);
			db.prepare(
				`INSERT INTO book_progress (book_id, page, pages, percent, at)
				 VALUES (?, ?, ?, ?, ?)
				 ON CONFLICT (book_id) DO UPDATE SET page = excluded.page,
				 pages = excluded.pages, percent = excluded.percent, at = excluded.at
				 WHERE excluded.at > book_progress.at
				 AND NOT (excluded.page IS book_progress.page
				 AND excluded.pages IS book_progress.pages
				 AND excluded.percent IS book_progress.percent)`,
			).run(
				update.bookId,
				update.page ?? null,
				update.pages ?? null,
				update.percent ?? null,
				update.at,
			);
		}
		setMeta(db, SEEDED_KEY, "1");
		setMeta(db, READ_AT_KEY, now.toISOString());
		db.exec("COMMIT");
	} catch (error) {
		db.exec("ROLLBACK");
		throw error;
	}

	// The description and average rating, once per book that could be the
	// Spotlight. A lookup that fails is tried again on the next read; it does
	// not make the read a failure.
	const wanted = db
		.prepare(
			`SELECT book_id FROM books
			 WHERE book_id IS NOT NULL
			 AND book_id NOT IN (SELECT book_id FROM book_details)
			 AND (shelf = 'reading' OR first_read_on >= ? OR position = 0)
			 ORDER BY shelf = 'reading' DESC, position LIMIT ?`,
		)
		.all(addDays(today, -SPOTLIGHT_ELIGIBLE_DAYS), LOOKUPS_PER_READ) as {
		book_id: string;
	}[];
	for (const [index, { book_id: bookId }] of wanted.entries()) {
		if (index > 0) {
			await pause(PAUSE_BETWEEN_LOOKUPS_MS);
		}
		try {
			const resource = `resources[Book.${bookId}]`;
			const details = parseTooltip(
				await get(
					`${GOODREADS}/tooltips?${resource}[type]=Book&${resource}[id]=${bookId}`,
				),
				bookId,
			);
			db.prepare(
				`INSERT OR REPLACE INTO book_details (book_id, description, average_rating)
				 VALUES (?, ?, ?)`,
			).run(bookId, details.description ?? null, details.averageRating ?? null);
		} catch (error) {
			console.warn(`Goodreads lookup of book ${bookId} failed:`, error);
		}
	}
}

interface BookRow {
	review_id: string;
	book_id: string | null;
	title: string;
	author: string | null;
	cover_url: string | null;
	stars: number | null;
	shelf: "reading" | "read";
	first_read_on: string | null;
	page: number | null;
	pages: number | null;
	percent: number | null;
	at: string | null;
	description: string | null;
	average_rating: number | null;
}

function toShelfBook(row: BookRow): ShelfBook {
	const book: ShelfBook = {
		id: row.review_id,
		title: row.title,
		shelf: row.shelf,
	};
	if (row.book_id) book.bookId = row.book_id;
	if (row.author) book.author = row.author;
	if (row.cover_url) book.coverUrl = row.cover_url;
	if (row.stars) book.stars = row.stars;
	if (row.first_read_on) book.finishedOn = row.first_read_on;
	if (row.at) {
		book.progress = { at: row.at };
		if (row.page !== null) book.progress.page = row.page;
		if (row.pages !== null) book.progress.pages = row.pages;
		if (row.percent !== null) book.progress.percent = row.percent;
	}
	if (row.description) book.description = row.description;
	if (row.average_rating) book.publicRating = row.average_rating;
	return book;
}

/**
 * What the Collector publishes of the owner's books: every book on the
 * currently-reading shelf, latest progress first, then the latest read,
 * those with a finish date first. Null until Goodreads has been read once.
 */
export function homeBooks(db: Database): HomeBooks | null {
	const readAt = getMeta(db, READ_AT_KEY);
	if (!readAt) {
		return null;
	}
	const select = `
		SELECT books.*, page, pages, percent, at, description, average_rating
		FROM books
		LEFT JOIN book_progress USING (book_id)
		LEFT JOIN book_details USING (book_id)`;
	const reading = db
		.prepare(
			`${select} WHERE shelf = 'reading'
			 ORDER BY at IS NULL, at DESC, position`,
		)
		.all() as unknown as BookRow[];
	const read = db
		.prepare(
			`${select} WHERE shelf = 'read'
			 ORDER BY first_read_on IS NULL, first_read_on DESC,
			 position IS NULL, position LIMIT ?`,
		)
		.all(READ_BOOKS_PUBLISHED) as unknown as BookRow[];
	return { books: [...reading, ...read].map(toShelfBook), readAt };
}

/** Rewrite `home:books` from the record. */
export async function publishBooks(
	db: Database,
	redis: HomeRedis,
): Promise<void> {
	const books = homeBooks(db);
	if (books) {
		await redis.set(HOME_KEYS.BOOKS, books);
	}
}

/** The Goodreads read, every 6 hours from the home connection. */
export function goodreadsJob(options: GoodreadsOptions): Job {
	return {
		name: "goodreads",
		isDue: everyHours(6),
		run: (now) => readGoodreads(options, now),
	};
}
