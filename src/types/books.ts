/** Where the owner is in a book, as last posted to Goodreads. */
export interface ReadingProgress {
	page?: number;
	pages?: number;
	/** 0-100, when the update gave a percentage and no page */
	percent?: number;
	/**
	 * When the update was posted. Goodreads does not say which time zone its
	 * times are in, so this is good to the day and no finer.
	 */
	at: string;
}

/** A book on one of the owner's Goodreads shelves, as the Collector publishes it. */
export interface ShelfBook {
	/** The Goodreads review id: one per owner and book */
	id: string;
	/** The Goodreads book id, where the cover gives it away */
	bookId?: string;
	title: string;
	/** The first author */
	author?: string;
	/** The cover at about 397x600 */
	coverUrl?: string;
	/** The owner's rating out of five; absent when unrated */
	stars?: number;
	/** `reading` is the currently-reading shelf */
	shelf: "reading" | "read";
	/**
	 * The day (`YYYY-MM-DD`) the Collector first saw the book as read.
	 * Goodreads gives no finish date, so a book already read when the
	 * Collector first ran has none.
	 */
	finishedOn?: string;
	/** The latest progress update, where the owner has posted one */
	progress?: ReadingProgress;
	/** The Goodreads description */
	description?: string;
	/** Goodreads' average rating, out of five */
	publicRating?: number;
}

/** The value of `home:books`: currently-reading first, then the latest read. */
export interface HomeBooks {
	books: ShelfBook[];
	/** When Goodreads was last read without a failure */
	readAt: string;
}

/** A shelf book with what the poster pipeline added. */
export interface Book extends ShelfBook {
	/** Source URL of the artwork with a stored Spotlight poster */
	posterUrl?: string;
	/** Source URL of the artwork with a stored thumbnail */
	thumbnailUrl?: string;
}

export interface BooksData {
	books: Book[];
	errors: string[];
	fetchedAt: string;
}
