import { CACHE_KEYS, CACHE_TTL, cacheGetLatest } from "@/lib/cache/redis";
import { getPoster } from "@/lib/poster/poster";
import {
	isRecentWatch,
	latestWatches,
	seasonProgress,
} from "@/lib/shows/progress";
import type {
	Show,
	ShowsData,
	TraktActivity,
	WatchedEpisode,
	WatchedSeason,
} from "@/types/shows";
import { lookupShow } from "./tmdb";
import { getShowSchedule, getTraktActivity } from "./trakt";

/**
 * At most this many shows inside their eligibility window get their seasons,
 * Catalog data and posters, so a first refresh stays inside the function
 * timeout.
 */
const MAX_PREPARED = 10;
/** With nothing eligible, this many of the latest are prepared. */
const FALLBACK_PREPARED = 3;

function toShow(watch: WatchedEpisode): Show {
	const show: Show = {
		id: watch.showId,
		title: watch.showTitle,
		season: watch.season,
		episode: watch.number,
		watchedAt: watch.watchedAt,
	};
	if (watch.year !== undefined) {
		show.year = watch.year;
	}
	if (watch.tmdbId !== undefined) {
		show.tmdbId = watch.tmdbId;
	}
	return show;
}

/**
 * Work out where the owner is in the show's season, add the Catalog's
 * details and make its posters. A failure here leaves the show without that
 * detail; it never fails the refresh.
 */
async function prepareForScreen(
	watch: WatchedEpisode,
	watchedSeasons: WatchedSeason[],
	withThumbnail: boolean,
	errors: string[],
): Promise<Show> {
	const show = toShow(watch);

	const [schedule, catalog] = await Promise.all([
		getShowSchedule(show.id, show.watchedAt).catch((error) => {
			errors.push(`Trakt (${show.title}): ${error}`);
			return null;
		}),
		show.tmdbId === undefined
			? null
			: lookupShow(show.tmdbId).catch((error) => {
					errors.push(`TMDB (${show.title}): ${error}`);
					return null;
				}),
	]);

	const progress =
		schedule && seasonProgress(show.season, watchedSeasons, schedule);
	if (progress) {
		show.progress = progress;
	}
	if (catalog?.overview) {
		show.overview = catalog.overview;
	}
	if (catalog?.rating !== undefined) {
		show.publicRating = catalog.rating;
	}

	const artworkUrl = catalog?.posterUrl;
	if (artworkUrl) {
		try {
			// TMDB's artwork may not be kept for ever
			await getPoster(artworkUrl, "spotlight", CACHE_TTL.TMDB_DERIVED);
			show.posterUrl = artworkUrl;
			if (withThumbnail) {
				await getPoster(artworkUrl, "thumbnail", CACHE_TTL.TMDB_DERIVED);
				show.thumbnailUrl = artworkUrl;
			}
		} catch (error) {
			errors.push(`Artwork (${show.title}): ${error}`);
		}
	}

	return show;
}

/**
 * Read what the owner has watched and prepare the shows the screen can
 * show. When Trakt fails it is Stale: its last good activity stays on screen.
 */
export async function getShowsData(): Promise<ShowsData> {
	const errors: string[] = [];

	let activity: TraktActivity;
	try {
		activity = await getTraktActivity();
	} catch (error) {
		const lastGood = await cacheGetLatest<TraktActivity>(
			CACHE_KEYS.SHOWS_TRAKT,
		).catch(() => null);
		if (!lastGood) {
			throw error;
		}
		errors.push(`Trakt: ${error}`);
		activity = lastGood;
	}

	const now = new Date();
	const watches = latestWatches(activity.history);
	const recent = watches.filter((watch) => isRecentWatch(watch.watchedAt, now));
	const prepared = new Set(
		(recent.length > 0
			? recent.slice(0, MAX_PREPARED)
			: watches.slice(0, FALLBACK_PREPARED)
		).map((watch) => watch.showId),
	);
	const watchedSeasons = new Map(
		activity.watched.map((show) => [show.showId, show.seasons]),
	);

	const shows: Show[] = [];
	for (const [index, watch] of watches.entries()) {
		shows.push(
			prepared.has(watch.showId)
				? await prepareForScreen(
						watch,
						watchedSeasons.get(watch.showId) ?? [],
						// Only the latest show can appear on the shows Medium card
						index === 0,
						errors,
					)
				: toShow(watch),
		);
	}

	return { shows, errors, fetchedAt: now.toISOString() };
}
