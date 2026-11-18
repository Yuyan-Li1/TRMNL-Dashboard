import { daysSinceDay } from "@/lib/owner-day";
import type { ShelfBook } from "@/types/books";

/** A book stays eligible for the Spotlight this long after its activity. */
export const SPOTLIGHT_ELIGIBLE_DAYS = 14;

/**
 * The day (`YYYY-MM-DD`) of a book's activity: its latest progress update
 * while it is being read, the day it was first seen as read once finished.
 * Goodreads does not say which time zone a progress update's time is in, so
 * only its date is used. Undefined for a book with neither.
 */
export function activityDay(book: ShelfBook): string | undefined {
	return book.shelf === "reading"
		? book.progress?.at.slice(0, 10)
		: book.finishedOn;
}

/** Whole days since a book's activity, where it has any. */
export function daysSinceActivity(
	book: ShelfBook,
	now: Date,
): number | undefined {
	const day = activityDay(book);
	return day === undefined ? undefined : daysSinceDay(day, now);
}

/**
 * Whether a book is inside its Spotlight eligibility window: In progress
 * with a progress update in the last 14 days, or Finished in the last 14.
 */
export function isEligibleForSpotlight(book: ShelfBook, now: Date): boolean {
	const days = daysSinceActivity(book, now);
	return days !== undefined && days <= SPOTLIGHT_ELIGIBLE_DAYS;
}

/**
 * The book with the latest activity, which the books Medium card shows
 * however old it is. When no book has a dated activity it is the first as
 * published: a book being read, else the newest on the read shelf.
 */
export function latestBook<T extends ShelfBook>(books: T[]): T | undefined {
	let latest: T | undefined;
	let latestDay = "";
	for (const book of books) {
		const day = activityDay(book);
		if (day !== undefined && day > latestDay) {
			latest = book;
			latestDay = day;
		}
	}
	return latest ?? books[0];
}
