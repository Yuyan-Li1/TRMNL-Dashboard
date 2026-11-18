import { nameKey } from "@/lib/consumed/set";
import type { CatalogMatch } from "../consumed/merge";
import { fetchText } from "./read";

const GOODREADS = "https://www.goodreads.com";

/** One book in Goodreads' search-box answer. */
interface SearchedBook {
	bookId?: string | number;
	title?: string;
	/** The title without the series */
	bookTitleBare?: string;
	author?: { name?: string };
}

/**
 * Pick the book a line names from a search answer: the first with the same
 * title and, where one is given, the same first author. Only an exact match
 * is trusted.
 */
export function pickBook(
	body: unknown,
	title: string,
	author?: string,
): CatalogMatch | null {
	if (!Array.isArray(body)) {
		throw new Error("Goodreads answered the search with something else");
	}
	const wanted = nameKey("book", title, author);
	for (const book of body as SearchedBook[]) {
		const found = book.bookTitleBare ?? book.title;
		if (!found || book.bookId === undefined) {
			continue;
		}
		const name = book.author?.name;
		if (nameKey("book", found, author && name) !== wanted) {
			continue;
		}
		const match: CatalogMatch = { id: String(book.bookId), title: found };
		if (name) {
			match.author = name;
		}
		return match;
	}
	return null;
}

/** Find a book in Goodreads by title, with no login, as its search box does. */
export async function findBook(
	title: string,
	author?: string,
	get: (url: string) => Promise<string> = fetchText,
): Promise<CatalogMatch | null> {
	const query = [title, author].filter(Boolean).join(" ");
	const body: unknown = JSON.parse(
		await get(
			`${GOODREADS}/book/auto_complete?format=json&q=${encodeURIComponent(query)}`,
		),
	);
	return pickBook(body, title, author);
}
