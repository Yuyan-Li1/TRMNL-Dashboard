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

/** A diary entry with what the Catalog and the poster pipeline added. */
export interface Movie extends DiaryEntry {
	/** The Catalog's release year */
	releaseYear?: number;
	director?: string;
	/** The Catalog description (TMDB overview) */
	overview?: string;
	/** The Catalog's public rating, converted to five stars */
	publicRating?: number;
	/** Source URL of the artwork with a stored Spotlight poster */
	posterUrl?: string;
	/** Source URL of the artwork with a stored thumbnail */
	thumbnailUrl?: string;
}

export interface MoviesData {
	/** Most recently watched first */
	movies: Movie[];
	errors: string[];
	fetchedAt: string;
}
