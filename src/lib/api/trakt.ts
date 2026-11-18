import {
	CACHE_KEYS,
	CACHE_TTL,
	cacheGet,
	cacheSet,
	getRedis,
} from "@/lib/cache/redis";
import { TokenRejectedError, trackRead } from "@/lib/health/reads";
import type {
	NextEpisode,
	SeasonCounts,
	ShowSchedule,
	TraktActivity,
	WatchedEpisode,
	WatchedShow,
} from "@/types/shows";

/**
 * Trakt, the Source for shows, read from the owner's public profile with a
 * client id alone, no OAuth. The owner's Trakt data is synced from the
 * Sequel app. Trakt's `ending` field and `/shows/<id>/progress/watched` are
 * not used: the first is null even for an ended show, the second needs OAuth.
 */
const TRAKT_URL = "https://api.trakt.tv";
const FETCH_TIMEOUT_MS = 10_000;
/** The latest watched episodes read from the history: its first page. */
const HISTORY_LIMIT = 100;

interface TraktShow {
	title?: string;
	year?: number | null;
	ids?: { trakt?: number; tmdb?: number | null };
}

interface TraktHistoryItem {
	watched_at?: string;
	episode?: { season?: number; number?: number; title?: string | null };
	show?: TraktShow;
}

interface TraktWatchedShow {
	show?: TraktShow;
	seasons?: {
		number?: number;
		episodes?: { number?: number; last_watched_at?: string }[];
	}[];
}

interface TraktSeason {
	number?: number;
	episode_count?: number;
	aired_episodes?: number;
}

interface TraktEpisode {
	season?: number;
	number?: number;
	first_aired?: string | null;
}

function asList<T>(body: unknown, what: string): T[] {
	if (!Array.isArray(body)) {
		throw new Error(`Trakt answered ${what} with something that is not a list`);
	}
	return body as T[];
}

/** The watched episodes in a history response, in Trakt's order: newest first. */
export function parseHistory(body: unknown): WatchedEpisode[] {
	const episodes: WatchedEpisode[] = [];
	for (const item of asList<TraktHistoryItem>(body, "the history")) {
		const { episode, show, watched_at: watchedAt } = item;
		const showId = show?.ids?.trakt;
		if (
			!watchedAt ||
			showId === undefined ||
			!show?.title ||
			episode?.season === undefined ||
			episode.number === undefined
		) {
			continue;
		}
		const watchedEpisode: WatchedEpisode = {
			showId,
			showTitle: show.title,
			season: episode.season,
			number: episode.number,
			watchedAt,
		};
		if (show.year) {
			watchedEpisode.year = show.year;
		}
		if (show.ids?.tmdb) {
			watchedEpisode.tmdbId = show.ids.tmdb;
		}
		if (episode.title) {
			watchedEpisode.title = episode.title;
		}
		episodes.push(watchedEpisode);
	}
	return episodes;
}

/** Every show in a watched-shows response, with its watched episodes by season. */
export function parseWatchedShows(body: unknown): WatchedShow[] {
	const shows: WatchedShow[] = [];
	for (const item of asList<TraktWatchedShow>(body, "the watched shows")) {
		const showId = item.show?.ids?.trakt;
		if (showId === undefined) {
			continue;
		}
		if (!Array.isArray(item.seasons)) {
			throw new Error("Trakt answered the watched shows without seasons");
		}
		shows.push({
			showId,
			seasons: item.seasons.flatMap((season) =>
				season.number === undefined
					? []
					: [
							{
								number: season.number,
								episodes: (season.episodes ?? []).flatMap((episode) =>
									episode.number === undefined || !episode.last_watched_at
										? []
										: [
												{
													number: episode.number,
													lastWatchedAt: episode.last_watched_at,
												},
											],
								),
							},
						],
			),
		});
	}
	return shows;
}

/** Each season's episode count and aired count, specials as season 0. */
export function parseSeasons(body: unknown): SeasonCounts[] {
	return asList<TraktSeason>(body, "the seasons").flatMap((season) =>
		season.number === undefined
			? []
			: [
					{
						number: season.number,
						episodeCount: season.episode_count ?? 0,
						airedEpisodes: season.aired_episodes ?? 0,
					},
				],
	);
}

/** The next scheduled episode, or null when the answer does not name one. */
export function parseNextEpisode(body: unknown): NextEpisode | null {
	const episode = (body ?? {}) as TraktEpisode;
	if (episode.season === undefined || episode.number === undefined) {
		return null;
	}
	const next: NextEpisode = { season: episode.season, number: episode.number };
	if (episode.first_aired) {
		next.airsAt = episode.first_aired;
	}
	return next;
}

/** Ask Trakt. Null is a 204: Trakt has nothing to say. */
async function traktGet(path: string): Promise<unknown> {
	const clientId = process.env.TRAKT_CLIENT_ID;
	if (!clientId) {
		throw new Error("TRAKT_CLIENT_ID not configured");
	}

	const response = await fetch(`${TRAKT_URL}${path}`, {
		headers: {
			"Content-Type": "application/json",
			"User-Agent": "media-dashboard",
			"trakt-api-version": "2",
			"trakt-api-key": clientId,
		},
		signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
	});
	if (response.status === 204) {
		return null;
	}
	// 403 is Trakt's answer to a client id it does not accept
	if (response.status === 401 || response.status === 403) {
		throw new TokenRejectedError(
			`Trakt rejected the client id: ${response.status} ${path}`,
		);
	}
	if (!response.ok) {
		throw new Error(`Trakt request failed: ${response.status} ${path}`);
	}
	return response.json();
}

/**
 * The owner's latest watched episodes and, for the shows among them, every
 * episode watched. Cached for an hour: Trakt itself caches user endpoints
 * that long, and the watched shows are a 333 KB answer.
 */
export async function getTraktActivity(): Promise<TraktActivity> {
	const cached = await cacheGet<TraktActivity>(CACHE_KEYS.SHOWS_TRAKT);
	if (cached) {
		return cached;
	}

	return trackRead("trakt", async () => {
		const slug = process.env.TRAKT_USER_SLUG;
		if (!slug) {
			throw new Error("TRAKT_USER_SLUG not configured");
		}
		const user = `/users/${encodeURIComponent(slug)}`;

		const [history, watched] = await Promise.all([
			traktGet(`${user}/history/episodes?limit=${HISTORY_LIMIT}`).then(
				parseHistory,
			),
			// Without `progress` there is no `seasons` array
			traktGet(`${user}/watched/shows?extended=full,progress`).then(
				parseWatchedShows,
			),
		]);

		// Only the shows in the history are used, and the rest is most of the size
		const recent = new Set(history.map((episode) => episode.showId));
		const activity: TraktActivity = {
			history,
			watched: watched.filter((show) => recent.has(show.showId)),
		};

		await cacheSet(CACHE_KEYS.SHOWS_TRAKT, activity, CACHE_TTL.SHOWS);
		return activity;
	});
}

/**
 * A show's seasons and next episode, apart from the owner's activity. The
 * answer is reused for a day unless `askAgain` is set. When Trakt fails, the
 * last good answer is returned with the error: stale but never missing.
 */
export async function getShowSchedule(
	showId: number,
	askAgain = false,
): Promise<{ schedule: ShowSchedule; error?: unknown }> {
	const redis = getRedis();
	const key = `trakt:show:${showId}`;
	const stored = await redis.get<ShowSchedule>(key);
	const ageSeconds = stored
		? (Date.now() - new Date(stored.fetchedAt).getTime()) / 1000
		: Number.POSITIVE_INFINITY;
	if (stored && !askAgain && ageSeconds < CACHE_TTL.TRAKT_SCHEDULE) {
		return { schedule: stored };
	}

	try {
		const [seasons, nextEpisode] = await trackRead("trakt", () =>
			Promise.all([
				traktGet(`/shows/${showId}/seasons?extended=full`).then(parseSeasons),
				traktGet(`/shows/${showId}/next_episode?extended=full`).then(
					parseNextEpisode,
				),
			]),
		);
		const schedule: ShowSchedule = {
			seasons,
			nextEpisode,
			fetchedAt: new Date().toISOString(),
		};
		await redis.set(key, schedule, { ex: CACHE_TTL.TRAKT_SCHEDULE_KEPT });
		return { schedule };
	} catch (error) {
		if (!stored) {
			throw error;
		}
		return { schedule: stored, error };
	}
}
