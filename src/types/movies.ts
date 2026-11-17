/** One logged watch of a movie in the owner's Letterboxd diary. */
export interface DiaryEntry {
	/** The feed's guid, e.g. `letterboxd-watch-123` or `letterboxd-review-123` */
	id: string;
	title: string;
	/** The release year as Letterboxd has it */
	year?: number;
	/** The day it was watched, `YYYY-MM-DD`; the diary records no time */
	watchedOn: string;
	rewatch: boolean;
	/** The owner's rating out of five, in half-star steps */
	stars?: number;
	/** The owner's review as plain text */
	review?: string;
	/** Absent when the entry is not a movie on TMDB */
	tmdbId?: string;
	/** The feed's own poster */
	imageUrl?: string;
}

export interface MoviesData {
	/** Most recently watched first */
	movies: DiaryEntry[];
	errors: string[];
	fetchedAt: string;
}
