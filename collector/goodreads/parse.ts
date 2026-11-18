import { decodeEntities } from "@/lib/html";
import type { ReadingProgress } from "@/types/books";

/**
 * Goodreads without a login: the embeddable shelf widget, the public list
 * of progress updates and the book tooltip. All unofficial; a page that
 * does not look as expected is an error, never an empty result.
 */

/** A book as the shelf widget lists it. */
export interface WidgetBook {
	reviewId: string;
	bookId?: string;
	title: string;
	author?: string;
	coverUrl?: string;
	/** The owner's rating, 1-5; absent when unrated */
	stars?: number;
}

/** One progress update: where the owner was in a book, and when. */
export interface ProgressUpdate extends ReadingProgress {
	bookId: string;
}

export interface BookDetails {
	description?: string;
	/** Goodreads' average rating, out of five */
	averageRating?: number;
}

const MONTHS = [
	"jan",
	"feb",
	"mar",
	"apr",
	"may",
	"jun",
	"jul",
	"aug",
	"sep",
	"oct",
	"nov",
	"dec",
];

function text(html: string): string {
	return decodeEntities(html.replace(/<[^>]+>/g, ""))
		.replace(/\s+/g, " ")
		.trim();
}

/**
 * The cover at about 397x600. The size is a suffix Goodreads' image host
 * resizes by; it never upscales. A book without a cover has a placeholder.
 */
function cover(src: string): { bookId?: string; coverUrl?: string } {
	const sized = src.match(/\/(\d+)\._S[XY]\d+_\.(\w+)$/);
	if (!sized || src.includes("nophoto")) {
		return {};
	}
	return {
		bookId: sized[1],
		coverUrl: src.replace(/\._S[XY]\d+_\./, "._SY600_."),
	};
}

/**
 * The books in a shelf widget (`/review/custom_widget/<id>`), in the
 * widget's order. The widget is JavaScript that writes HTML. Its header
 * links to the shelf it served, which is how a stale or wrong answer is
 * told from a shelf that is really empty.
 */
export function parseWidget(script: string, shelf: string): WidgetBook[] {
	const code = script.match(/var widget_code = '([\s\S]*?)'\s*\n/);
	if (!code) {
		throw new Error("Goodreads answered with a page that is not a widget");
	}
	const html = code[1].replace(/\\(.)/g, (_, char: string) =>
		char === "n" ? "\n" : char,
	);
	const served = html.match(
		/gr_custom_header_[^>]*>\s*<a [^>]*href="[^"]*[?&]shelf=([^&"]*)/,
	);
	if (!served || decodeURIComponent(served[1]) !== shelf) {
		throw new Error(
			`Goodreads widget is for the shelf "${served?.[1] ?? "?"}", not "${shelf}"`,
		);
	}

	return html
		.split(/<div class="gr_custom_each_container_/)
		.slice(1)
		.map((entry) => {
			const reviewId = entry.match(/\/review\/show\/(\d+)/)?.[1];
			const title = entry.match(
				/gr_custom_title_[^>]*>\s*<a [^>]*>([\s\S]*?)<\/a>/,
			)?.[1];
			if (!reviewId || !title) {
				throw new Error("Goodreads widget has a book it does not name");
			}
			const book: WidgetBook = { reviewId, title: text(title) };
			const author = entry.match(
				/gr_custom_author_[^>]*>[\s\S]*?<a [^>]*>([\s\S]*?)<\/a>/,
			)?.[1];
			if (author) {
				book.author = text(author);
			}
			const image = entry.match(
				/gr_custom_book_container_[\s\S]*?<img [^>]*src="([^"]+)"/,
			)?.[1];
			Object.assign(book, image ? cover(image) : {});
			const stars = entry.match(/gr_flat_red_star_active/g)?.length ?? 0;
			if (stars > 0) {
				book.stars = stars;
			}
			return book;
		});
}

/**
 * A time as the progress list writes it. Goodreads does not say which time
 * zone "Jun 02, 2026 07:27AM" is in; it is read as UTC, so it is good to the
 * day and no finer. A recent update may be written "21 hours, 40 min ago".
 */
function parseTime(written: string, now: Date): string | undefined {
	const absolute = written.match(
		/^(\w{3})\w* (\d{1,2}), (\d{4}) (\d{1,2}):(\d{2})\s*([AP]M)$/i,
	);
	if (absolute) {
		const [, month, day, year, hour, minute, half] = absolute;
		const monthIndex = MONTHS.indexOf(month.toLowerCase());
		if (monthIndex < 0) {
			return undefined;
		}
		const hours = (Number(hour) % 12) + (half.toUpperCase() === "PM" ? 12 : 0);
		return new Date(
			Date.UTC(Number(year), monthIndex, Number(day), hours, Number(minute)),
		).toISOString();
	}
	if (!/ago$/i.test(written)) {
		return undefined;
	}
	const UNIT_MS: Record<string, number> = {
		day: 24 * 60 * 60 * 1000,
		hour: 60 * 60 * 1000,
		min: 60 * 1000,
	};
	let ago = 0;
	for (const [, count, unit] of written.matchAll(/(\d+) (day|hour|min)/gi)) {
		ago += Number(count) * UNIT_MS[unit.toLowerCase()];
	}
	return new Date(now.getTime() - ago).toISOString();
}

/**
 * The progress updates on the owner's public list (`/user_status/list/<id>`),
 * newest first: "is on page 137 of 248 of", "is 81% done with" and "is
 * starting". Updates that are not about a book are left out.
 */
export function parseProgressList(html: string, now: Date): ProgressUpdate[] {
	if (!html.includes("Recent Status Updates")) {
		throw new Error(
			"Goodreads answered with a page that is not the progress list",
		);
	}
	const updates: ProgressUpdate[] = [];
	for (const entry of html.split(/<div id="user_status_\d+">/).slice(1)) {
		const header = entry.match(/user_status_header">([\s\S]*?)<\/span>/)?.[1];
		const bookId = header?.match(/\/book\/show\/(\d+)/)?.[1];
		const written = entry.match(/\/user_status\/show\/\d+">([^<]+)<\/a>/)?.[1];
		const at = written && parseTime(written.trim(), now);
		if (!header || !bookId || !at) {
			continue;
		}
		const page = header.match(/is on page (\d+) of (\d+) of/);
		const percent = header.match(/is (\d+)% done with/);
		if (page) {
			updates.push({
				bookId,
				page: Number(page[1]),
				pages: Number(page[2]),
				at,
			});
		} else if (percent) {
			updates.push({ bookId, percent: Number(percent[1]), at });
		} else if (/is starting/.test(header)) {
			updates.push({ bookId, percent: 0, at });
		}
	}
	return updates;
}

/**
 * A book's description and average rating from its tooltip
 * (`/tooltips?resources[Book.<id>]...`), the lightest page that has both.
 */
export function parseTooltip(json: string, bookId: string): BookDetails {
	let html: unknown;
	try {
		html = (JSON.parse(json) as { tooltips?: Record<string, unknown> })
			.tooltips?.[`Book.${bookId}`];
	} catch {
		html = undefined;
	}
	if (typeof html !== "string") {
		throw new Error(`Goodreads has no tooltip for book ${bookId}`);
	}
	const details: BookDetails = {};
	const rating = Number(html.match(/([\d.]+) avg rating/)?.[1]);
	if (rating > 0) {
		details.averageRating = rating;
	}
	// The whole description is in a hidden span when it is cut short
	const description =
		html.match(/<span id="freeText\d+"[^>]*>([\s\S]*?)<\/span>/)?.[1] ??
		html.match(/<span id="freeTextContainer\d+"[^>]*>([\s\S]*?)<\/span>/)?.[1];
	const plain = description && text(description);
	if (plain) {
		details.description = plain;
	}
	return details;
}
