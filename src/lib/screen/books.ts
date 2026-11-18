import {
	activityDay,
	daysSinceActivity,
	isEligibleForSpotlight,
	latestBook,
} from "@/lib/books/shelf";
import type { Book } from "@/types/books";
import { formatDaysAgo } from "./format";
import type { MediumContent, SpotlightCandidate } from "./types";

/** A book that can be the Spotlight: it has artwork. */
interface SpotlightBook extends Book {
	posterUrl: string;
}

/** Where the owner is in a book: "Page 137 of 248" or "40%". */
function progressLabel(book: Book): string | undefined {
	const { progress } = book;
	if (progress?.page !== undefined && progress.pages !== undefined) {
		return `Page ${progress.page} of ${progress.pages}`;
	}
	return progress?.percent !== undefined ? `${progress.percent}%` : undefined;
}

/** How far through a book the owner is, 0-1. */
function progressShare(book: Book): number | undefined {
	const { progress } = book;
	if (progress?.page !== undefined && progress.pages) {
		return Math.min(1, progress.page / progress.pages);
	}
	return progress?.percent !== undefined
		? Math.min(1, progress.percent / 100)
		: undefined;
}

/** Goodreads' times are good to the day, so books say days, never hours. */
function when(book: Book, now: Date): string | undefined {
	const days = daysSinceActivity(book, now);
	return days === undefined ? undefined : formatDaysAgo(days);
}

function toCandidate(book: SpotlightBook, now: Date): SpotlightCandidate {
	const day = activityDay(book);
	const ago = when(book, now);
	const base = {
		id: `book:${book.id}`,
		medium: "book",
		title: book.title,
		byline: book.author ?? "",
		text: book.description,
		// Midnight UTC falls near the middle of the owner's day, as for a
		// movie's watched date. A book with no dated activity is the oldest.
		activityAt: new Date(day ? `${day}T00:00:00Z` : 0).toISOString(),
		posterUrl: book.posterUrl,
	} as const;
	if (book.shelf === "read") {
		return {
			...base,
			mode: "Finished",
			rating:
				book.stars !== undefined
					? { stars: book.stars, whose: "You" }
					: undefined,
			facts: ago ? [`Finished ${ago}`] : [],
		};
	}
	const label = progressLabel(book);
	return {
		...base,
		mode: "In progress",
		facts: [...(label ? [label] : []), ...(ago ? [`Updated ${ago}`] : [])],
		progress: progressShare(book),
	};
}

/**
 * What books contribute to the screen. A book on the currently-reading
 * shelf is In progress, eligible for the Spotlight while its latest progress
 * update is within 14 days; a book first seen as read is Finished, eligible
 * for 14 days from that day. Either needs artwork. The Medium card shows
 * the book with the latest activity, with its last known progress.
 */
export function booksContent(books: Book[], now: Date): MediumContent {
	const withArtwork = books.filter((book): book is SpotlightBook =>
		Boolean(book.posterUrl),
	);
	const latest = latestBook(books);
	return {
		medium: "book",
		eligible: withArtwork
			.filter((book) => isEligibleForSpotlight(book, now))
			.map((book) => toCandidate(book, now)),
		fallback: withArtwork.map((book) => toCandidate(book, now)),
		latest: latest
			? {
					title: latest.title,
					stars: latest.shelf === "read" ? latest.stars : undefined,
					detail: latest.shelf === "read" ? "Finished" : progressLabel(latest),
					when: when(latest, now),
					thumbnailUrl: latest.thumbnailUrl,
				}
			: null,
	};
}
