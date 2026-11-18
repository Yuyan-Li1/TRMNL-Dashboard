import { isEligibleForSpotlight, latestBook } from "@/lib/books/shelf";
import { getRedis } from "@/lib/cache/redis";
import { HOME_KEYS } from "@/lib/home/status";
import { getPoster } from "@/lib/poster/poster";
import type { Book, BooksData, HomeBooks, ShelfBook } from "@/types/books";

/**
 * At most this many books inside their eligibility window get posters, so a
 * first refresh stays inside the function timeout.
 */
const MAX_PREPARED = 20;
/** With nothing eligible, this many of the first with a cover are prepared. */
const FALLBACK_PREPARED = 3;

/**
 * Make a book's posters from its Goodreads cover. A failure here leaves the
 * book without artwork; it never fails the refresh.
 */
async function prepareForScreen(
	shelfBook: ShelfBook,
	targets: { spotlight: boolean; thumbnail: boolean },
	errors: string[],
): Promise<Book> {
	const book: Book = { ...shelfBook };
	const url = shelfBook.coverUrl;
	if (!url) {
		return book;
	}
	if (targets.spotlight) {
		try {
			await getPoster(url, "spotlight");
			book.posterUrl = url;
		} catch (error) {
			errors.push(`Artwork (${book.title}): ${error}`);
		}
	}
	if (targets.thumbnail) {
		try {
			await getPoster(url, "thumbnail");
			book.thumbnailUrl = url;
		} catch (error) {
			errors.push(`Thumbnail (${book.title}): ${error}`);
		}
	}
	return book;
}

/**
 * Read the books the Collector published and prepare those the screen can
 * show. Goodreads is read by the home server, never from here: this only
 * dithers the covers, as for every other Medium. Before the Collector has
 * published anything there are no books.
 */
export async function getBooksData(): Promise<BooksData> {
	const errors: string[] = [];
	const now = new Date();
	const published = await getRedis().get<HomeBooks>(HOME_KEYS.BOOKS);
	const shelf = published?.books ?? [];

	const withCover = shelf.filter((book) => book.coverUrl);
	const eligible = withCover.filter((book) =>
		isEligibleForSpotlight(book, now),
	);
	const spotlight = new Set(
		(eligible.length > 0
			? eligible.slice(0, MAX_PREPARED)
			: withCover.slice(0, FALLBACK_PREPARED)
		).map((book) => book.id),
	);
	// Only the book with the latest activity can appear on the Medium card
	const latestId = latestBook(shelf)?.id;

	const books: Book[] = [];
	for (const book of shelf) {
		books.push(
			await prepareForScreen(
				book,
				{ spotlight: spotlight.has(book.id), thumbnail: book.id === latestId },
				errors,
			),
		);
	}
	return { books, errors, fetchedAt: now.toISOString() };
}
