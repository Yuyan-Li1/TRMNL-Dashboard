import {
	type PickTitle,
	type PoolPick,
	type PoolTitles,
	pickId,
} from "@/lib/picks/pool";
import { cutText } from "./format";
import type { Medium, SpotlightCandidate } from "./types";

/** A Recommendation's description is cut to about this many characters. */
const DESCRIPTION_LENGTH = 140;
/** A game on more Platforms than this names only the first few. */
const PLATFORMS_SHOWN = 4;

/** Whose public rating a Recommendation shows: the Medium's Catalog. */
const CATALOG_NAMES: Record<Medium, string> = {
	game: "IGDB",
	movie: "TMDB",
	show: "TMDB",
	book: "Goodreads",
};

const ID_PREFIX = "pick:";

/** The byline as for the Medium: year and director; year; Platforms. */
function byline(medium: Medium, title: PickTitle): string {
	if (medium === "game") {
		return (title.platforms ?? []).slice(0, PLATFORMS_SHOWN).join(", ");
	}
	return [title.year, title.director].filter(Boolean).join(", ");
}

/**
 * What the Pool contributes to the screen: each pick as a Recommendation,
 * with its reason, the Catalog's public rating and the Catalog description.
 * Its freshness is the day it entered the Pool. A pick whose title is not
 * stored cannot be shown and is left out.
 */
export function picksContent(
	picks: PoolPick[],
	titles: PoolTitles,
): SpotlightCandidate[] {
	return picks.flatMap((pick): SpotlightCandidate[] => {
		const title = titles[pickId(pick)];
		if (!title) {
			return [];
		}
		return [
			{
				id: `${ID_PREFIX}${pickId(pick)}`,
				medium: pick.medium,
				mode: "Recommendation",
				title: title.title,
				byline: byline(pick.medium, title),
				rating:
					title.publicRating !== undefined
						? { stars: title.publicRating, whose: CATALOG_NAMES[pick.medium] }
						: undefined,
				reason: pick.reason,
				facts: [],
				text: title.description
					? cutText(title.description, DESCRIPTION_LENGTH)
					: undefined,
				// Midnight UTC falls near the middle of the owner's day, as for
				// a movie's watched date
				activityAt: new Date(`${pick.enteredOn}T00:00:00Z`).toISOString(),
				posterUrl: title.posterUrl,
			},
		];
	});
}

/**
 * The `pickId` of the pick behind a Spotlight candidate; undefined for a
 * Title that is not a Recommendation from the Pool.
 */
export function poolPickId(candidate: SpotlightCandidate): string | undefined {
	return candidate.mode === "Recommendation" &&
		candidate.id.startsWith(ID_PREFIX)
		? candidate.id.slice(ID_PREFIX.length)
		: undefined;
}
