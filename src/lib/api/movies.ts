import { CACHE_KEYS, CACHE_TTL, cacheGetLatest } from "@/lib/cache/redis";
import { isEligibleForSpotlight } from "@/lib/movies/diary";
import { getPoster } from "@/lib/poster/poster";
import type { DiaryEntry, Movie, MoviesData } from "@/types/movies";
import { getDiaryEntries } from "./letterboxd";
import { lookupMovie } from "./tmdb";

/**
 * At most this many movies inside their eligibility window get Catalog data and posters,
 * so a first refresh stays inside the function timeout.
 */
const MAX_PREPARED = 20;
/** With nothing eligible, this many of the latest are prepared. */
const FALLBACK_PREPARED = 3;

/**
 * Add the Catalog's details to a diary entry and make its posters. Artwork
 * is looked for in the Catalog first, then in the feed. A failure here
 * leaves the movie without that detail; it never fails the refresh.
 */
async function prepareForScreen(
	entry: DiaryEntry,
	withThumbnail: boolean,
	errors: string[],
): Promise<Movie> {
	const movie: Movie = { ...entry };

	let catalogPosterUrl: string | undefined;
	if (entry.tmdbId) {
		try {
			const catalog = await lookupMovie(entry.tmdbId);
			movie.releaseYear = catalog?.year;
			movie.director = catalog?.director;
			movie.overview = catalog?.overview;
			movie.publicRating = catalog?.rating;
			catalogPosterUrl = catalog?.posterUrl;
		} catch (error) {
			errors.push(`TMDB (${entry.title}): ${error}`);
		}
	}

	const artwork = [
		// TMDB's artwork may not be kept for ever; the feed's own may
		{ url: catalogPosterUrl, ttl: CACHE_TTL.TMDB_DERIVED },
		{ url: entry.imageUrl, ttl: undefined },
	];
	for (const { url, ttl } of artwork) {
		if (!url) {
			continue;
		}
		try {
			await getPoster(url, "spotlight", ttl);
		} catch (error) {
			errors.push(`Artwork (${entry.title}): ${error}`);
			continue;
		}
		movie.posterUrl = url;
		if (withThumbnail) {
			try {
				await getPoster(url, "thumbnail", ttl);
				movie.thumbnailUrl = url;
			} catch (error) {
				errors.push(`Thumbnail (${entry.title}): ${error}`);
			}
		}
		break;
	}

	return movie;
}

/**
 * Read the owner's diary and prepare the movies the screen can show. When
 * Letterboxd fails it is Stale: its last good entries stay on screen.
 */
export async function getMoviesData(): Promise<MoviesData> {
	const errors: string[] = [];

	let entries: DiaryEntry[];
	try {
		entries = await getDiaryEntries();
	} catch (error) {
		const lastGood = await cacheGetLatest<DiaryEntry[]>(
			CACHE_KEYS.MOVIES_LETTERBOXD,
		).catch(() => null);
		if (!lastGood) {
			throw error;
		}
		errors.push(`Letterboxd: ${error}`);
		entries = lastGood;
	}

	const now = new Date();
	const eligible = entries.filter((entry) =>
		isEligibleForSpotlight(entry, now),
	);
	const prepared = new Set(
		(eligible.length > 0
			? eligible.slice(0, MAX_PREPARED)
			: entries.slice(0, FALLBACK_PREPARED)
		).map((entry) => entry.id),
	);

	const movies: Movie[] = [];
	for (const [index, entry] of entries.entries()) {
		movies.push(
			prepared.has(entry.id)
				? // Only the latest entry can appear on the movies Medium card
					await prepareForScreen(entry, index === 0, errors)
				: entry,
		);
	}

	return { movies, errors, fetchedAt: now.toISOString() };
}
