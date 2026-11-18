import { ownerDay } from "@/lib/owner-day";
import { daysSinceWatch, isEligibleForSpotlight } from "@/lib/shows/progress";
import type { Show } from "@/types/shows";
import { formatDaysAgo } from "./format";
import type { MediumContent, SpotlightCandidate } from "./types";

/** A show that can be the Spotlight: it has artwork. */
interface SpotlightShow extends Show {
	posterUrl: string;
}

/** The latest episode watched, with "caught up" where it applies: "S2 E5, caught up". */
function episodeLabel(show: Show): string {
	const episode = `S${show.season} E${show.episode}`;
	return show.progress?.state === "caught up"
		? `${episode}, caught up`
		: episode;
}

/** Trakt's times are accurate only to the day, so shows say days, never hours. */
function watchedWhen(watchedAt: string, now: Date): string {
	return formatDaysAgo(daysSinceWatch(watchedAt, now));
}

/**
 * The day of a watch as the freshness weight sees it. Midnight UTC falls
 * near the middle of the owner's day, as for a movie's watched date.
 */
function activityDay(watchedAt: string): string {
	return new Date(`${ownerDay(new Date(watchedAt))}T00:00:00Z`).toISOString();
}

function toCandidate(show: SpotlightShow, now: Date): SpotlightCandidate {
	const { progress } = show;
	const base = {
		id: `show:${show.id}`,
		medium: "show",
		title: show.title,
		byline: `Season ${show.season}`,
		text: show.overview,
		posterUrl: show.posterUrl,
	} as const;

	if (progress?.state === "finished") {
		// The season was finished when its last episode was watched
		const finishedAt = progress.finishedAt ?? show.watchedAt;
		return {
			...base,
			mode: "Finished",
			facts: ["Season finished", `Watched ${watchedWhen(finishedAt, now)}`],
			activityAt: activityDay(finishedAt),
		};
	}

	return {
		...base,
		mode: "In progress",
		facts: [episodeLabel(show), `Watched ${watchedWhen(show.watchedAt, now)}`],
		// Watched against aired episodes of the season
		progress:
			progress && progress.aired > 0
				? Math.min(1, progress.watched / progress.aired)
				: undefined,
		activityAt: activityDay(show.watchedAt),
	};
}

/**
 * What shows contribute to the screen. A show is Finished when the latest
 * season the owner has watched has ended and is fully watched, and In
 * progress otherwise, Caught up included. Either way it is eligible for the
 * Spotlight for 14 days, from the watch that finished the season or from
 * the latest watch, when it has artwork. Shows carry no owner's rating.
 * `shows` is most recently watched first.
 */
export function showsContent(shows: Show[], now: Date): MediumContent {
	const fallback = shows
		.filter((show): show is SpotlightShow => Boolean(show.posterUrl))
		.map((show) => toCandidate(show, now));
	const eligible = fallback.filter((candidate) =>
		isEligibleForSpotlight(candidate.activityAt, now),
	);

	const latest = shows[0];
	return {
		medium: "show",
		eligible,
		fallback,
		latest: latest
			? {
					title: latest.title,
					detail: episodeLabel(latest),
					when: watchedWhen(latest.watchedAt, now),
					thumbnailUrl: latest.thumbnailUrl,
				}
			: null,
	};
}
