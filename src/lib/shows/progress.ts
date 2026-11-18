import { daysSinceDay, ownerDay } from "@/lib/owner-day";
import type {
	SeasonCounts,
	SeasonProgress,
	ShowSchedule,
	WatchedEpisode,
	WatchedSeason,
} from "@/types/shows";

/**
 * A show is eligible for the Spotlight for this many days from its latest
 * watch (In progress) or from the watch that finished its season (Finished).
 */
export const SHOW_ELIGIBLE_DAYS = 14;

/**
 * Whole days since an episode was watched, in the owner's time zone. Trakt's
 * `watched_at` is accurate only to the day, so shows count days, never hours.
 */
export function daysSinceWatch(watchedAt: string, now: Date): number {
	return daysSinceDay(ownerDay(new Date(watchedAt)), now);
}

/** Whether a watch is inside the Spotlight eligibility window. */
export function isEligibleForSpotlight(watchedAt: string, now: Date): boolean {
	return daysSinceWatch(watchedAt, now) <= SHOW_ELIGIBLE_DAYS;
}

/**
 * The latest episode watched of each show in the history, most recently
 * watched show first: one entry for a show, never one per episode. Specials
 * (season 0) are ignored. Episodes marked watched at the same moment, as
 * bulk-marking does, count in season and episode order.
 */
export function latestWatches(history: WatchedEpisode[]): WatchedEpisode[] {
	const latest = new Map<number, WatchedEpisode>();
	const newestFirst = history
		.filter((episode) => episode.season > 0)
		.toSorted(
			(a, b) =>
				new Date(b.watchedAt).getTime() - new Date(a.watchedAt).getTime() ||
				b.season - a.season ||
				b.number - a.number,
		);
	for (const episode of newestFirst) {
		if (!latest.has(episode.showId)) {
			latest.set(episode.showId, episode);
		}
	}
	return [...latest.values()];
}

/**
 * Whether Trakt's counts for a season are behind what the owner has watched:
 * more episodes watched than have aired. Aired counts lag just after an
 * episode airs, so the show's schedule is worth asking for again.
 */
export function isBehindWatched(
	progress: SeasonProgress,
	counts: SeasonCounts | undefined,
): boolean {
	return (
		progress.state !== "finished" &&
		(progress.watched > progress.aired ||
			(counts !== undefined && progress.watched >= counts.episodeCount))
	);
}

/**
 * Where the owner is in one season of a show, from the episodes they have
 * watched and what Trakt says has aired.
 *
 * - The season has ended when every episode has aired and no next episode
 *   is scheduled in it.
 * - Finished: the season has ended and every episode of it is watched.
 * - Caught up: every aired episode is watched while the season still runs.
 *
 * Counts are compared, so an aired count that lags just after an episode
 * airs reads as caught up. Undefined when Trakt does not list the season.
 */
export function seasonProgress(
	season: number,
	watchedSeasons: WatchedSeason[],
	schedule: ShowSchedule,
): SeasonProgress | undefined {
	const counts = schedule.seasons.find((each) => each.number === season);
	if (!counts) {
		return undefined;
	}

	const episodes = new Map(
		(watchedSeasons.find((each) => each.number === season)?.episodes ?? []).map(
			(episode) => [episode.number, episode.lastWatchedAt],
		),
	);
	const watched = episodes.size;
	const aired = counts.airedEpisodes;

	const ended =
		aired > 0 &&
		aired >= counts.episodeCount &&
		schedule.nextEpisode?.season !== season;

	if (ended && watched >= counts.episodeCount) {
		const lastEpisode = Math.max(...episodes.keys());
		return {
			watched,
			aired,
			state: "finished",
			finishedAt: episodes.get(lastEpisode),
		};
	}
	if (!ended && aired > 0 && watched >= aired) {
		return { watched, aired, state: "caught up" };
	}
	return { watched, aired, state: "watching" };
}
