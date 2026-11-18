import { GAME_CONSUMED_MINUTES } from "@/lib/consumed/set";
import { addDays, daysSinceDay, ownerDay } from "@/lib/owner-day";
import type { Medium } from "@/lib/screen/types";
import { DAY_MS } from "@/lib/time";
import type { Game } from "@/types/gaming";
import type { Movie } from "@/types/movies";
import type { Show } from "@/types/shows";

/**
 * The Pool's rules: which Titles seed Catalog picks, how picks are chosen
 * from what the Catalog suggests for them, and when a pick leaves.
 */

/** The Pool holds up to this many Catalog picks per Medium. */
export const CATALOG_PICKS_PER_MEDIUM = 5;
/** A seed is a Title Finished or In progress in this many days. */
const SEED_DAYS = 90;
/** A Title the owner rated below this is not a seed. Unrated counts as liked. */
const SEED_MIN_STARS = 3.5;
/** A pick leaves the Pool after this many Spotlight appearances. */
const MAX_APPEARANCES = 3;
/** A pick leaves the Pool this many days after it entered. */
const MAX_DAYS_IN_POOL = 30;
/** A pick that has left may not return for 6 months. */
const BARRED_DAYS = 183;
/** A reason is at most this long. */
const REASON_MAX_LENGTH = 100;

export type PickOrigin = "catalog" | "llm";

/** One pick in the Pool, as Vercel's record of it has it. */
export interface PoolPick {
	medium: Medium;
	/** TMDB's id for a movie or show, IGDB's for a game */
	catalogId: string;
	origin: PickOrigin;
	/** "Because you watched X", or the LLM's own words */
	reason: string;
	/** The owner's day (`YYYY-MM-DD`) it entered the Pool */
	enteredOn: string;
}

/**
 * Vercel's record of the Pool. Each pick's count of Spotlight appearances is
 * kept beside it, in a Redis hash the page can add to without rewriting this.
 */
export interface PoolRecord {
	picks: PoolPick[];
	/** Picks that have left, by `pickId`: the day each may return */
	barred: Record<string, string>;
}

/**
 * What the Catalog says about a pick, for the screen. Kept apart from the
 * record because TMDB's text may not be kept for ever.
 */
export interface PickTitle {
	title: string;
	/** The year it was released or first aired; movies and shows */
	year?: number;
	/** Movies */
	director?: string;
	/** The Platforms a game is on, as IGDB abbreviates them */
	platforms?: string[];
	/** The Catalog description */
	description?: string;
	/** The Catalog's public rating, converted to five stars */
	publicRating?: number;
	/** Source URL of the artwork with a stored Spotlight poster */
	posterUrl: string;
}

/** The stored titles of the picks in the Pool, by `pickId`. */
export type PoolTitles = Record<string, PickTitle>;

/** What names a pick in the appearance counts, the bars and the stored titles. */
export function pickId(pick: { medium: Medium; catalogId: string }): string {
	return `${pick.medium}:${pick.catalogId}`;
}

/** Whether a pick that left the Pool may not yet return. */
export function isBarred(
	record: PoolRecord,
	pick: { medium: Medium; catalogId: string },
	now: Date,
): boolean {
	const until = record.barred[pickId(pick)];
	return until !== undefined && until > ownerDay(now);
}

/**
 * The movies that seed Catalog picks: watched in the last 90 days and not
 * rated below 3.5 stars, each once, as its latest watch. `movies` is most
 * recently watched first.
 */
export function seedMovies(
	movies: Movie[],
	now: Date,
): (Movie & { tmdbId: string })[] {
	const seen = new Set<string>();
	const seeds: (Movie & { tmdbId: string })[] = [];
	for (const movie of movies) {
		const { tmdbId } = movie;
		if (!tmdbId || seen.has(tmdbId)) {
			continue;
		}
		seen.add(tmdbId);
		if (
			daysSinceDay(movie.watchedOn, now) <= SEED_DAYS &&
			(movie.stars === undefined || movie.stars >= SEED_MIN_STARS)
		) {
			seeds.push({ ...movie, tmdbId });
		}
	}
	return seeds;
}

function withinSeedDays(at: string | undefined, now: Date): boolean {
	return (
		at !== undefined &&
		now.getTime() - new Date(at).getTime() <= SEED_DAYS * DAY_MS
	);
}

/**
 * The shows that seed Catalog picks: an episode watched in the last 90
 * days. Shows carry no owner's rating. `shows` is most recently watched first.
 */
export function seedShows(
	shows: Show[],
	now: Date,
): (Show & { tmdbId: number })[] {
	return shows.filter(
		(show): show is Show & { tmdbId: number } =>
			show.tmdbId !== undefined && withinSeedDays(show.watchedAt, now),
	);
}

/**
 * The games that seed Catalog picks: played in the last 90 days, for 30
 * minutes or more in all, so a game tried once and put down is not one. A
 * game with no play time recorded counts. Games carry no owner's rating.
 * `games` is most recently played first.
 */
export function seedGames(games: Game[], now: Date): Game[] {
	return games.filter(
		(game) =>
			withinSeedDays(game.lastPlayedAt, now) &&
			(game.minutesPlayed === undefined ||
				game.minutesPlayed >= GAME_CONSUMED_MINUTES),
	);
}

/** A Catalog pick's reason: the Title it was suggested for. */
export function reasonFor(medium: Medium, seedTitle: string): string {
	const reason = `Because you ${medium === "game" ? "played" : "watched"} ${seedTitle}`;
	return reason.length <= REASON_MAX_LENGTH
		? reason
		: `${reason.slice(0, REASON_MAX_LENGTH - 3).trimEnd()}...`;
}

interface ChoosePicksInput<Seed, Result, Chosen> {
	/** Newest first */
	seeds: Seed[];
	/** How many picks the Medium still has room for */
	wanted: number;
	/**
	 * What the Catalog suggests for a seed, best first. Asked once per seed,
	 * and only when its turn comes.
	 */
	resultsOf(seed: Seed): Promise<Result[]>;
	/** In the consumed set, already in the Pool, or barred from returning */
	isExcluded(result: Result): boolean;
	/** Make a result into a pick, or null when it cannot be one: no artwork */
	accept(result: Result): Promise<Chosen | null>;
}

/**
 * Choose Catalog picks for one Medium: go round the seeds, newest first,
 * taking each seed's best result that is not excluded, until there are as
 * many as wanted or the seeds have nothing left.
 */
export async function choosePicks<
	Seed,
	Result extends { catalogId: string },
	Chosen,
>({
	seeds,
	wanted,
	resultsOf,
	isExcluded,
	accept,
}: ChoosePicksInput<Seed, Result, Chosen>): Promise<
	{ seed: Seed; pick: Chosen }[]
> {
	const chosen: { seed: Seed; pick: Chosen }[] = [];
	const taken = new Set<string>();
	const remaining = new Map<Seed, Result[]>();

	let tookOne = true;
	while (tookOne) {
		tookOne = false;
		for (const seed of seeds) {
			if (chosen.length >= wanted) {
				return chosen;
			}
			let results = remaining.get(seed);
			if (!results) {
				results = [...(await resultsOf(seed))];
				remaining.set(seed, results);
			}
			for (let result = results.shift(); result; result = results.shift()) {
				if (taken.has(result.catalogId) || isExcluded(result)) {
					continue;
				}
				const pick = await accept(result);
				if (pick !== null) {
					taken.add(result.catalogId);
					chosen.push({ seed, pick });
					tookOne = true;
					break;
				}
			}
		}
	}
	return chosen;
}

interface RetirePicksInput {
	/** Spotlight appearances so far, by `pickId` */
	appearances: Record<string, number>;
	/** Whether the pick's Title is in the owner's activity or the consumed set */
	isKnown(pick: PoolPick): boolean;
	now: Date;
}

/**
 * The Pool after the picks due to leave have left: one whose Title has
 * appeared in the owner's activity, one that has had 3 Spotlight
 * appearances, one that entered more than 30 days ago. Each is barred from
 * returning for 6 months; bars that have run out are dropped.
 */
export function retirePicks(
	record: PoolRecord,
	{ appearances, isKnown, now }: RetirePicksInput,
): PoolRecord {
	const today = ownerDay(now);
	const barred = Object.fromEntries(
		Object.entries(record.barred).filter(([, until]) => until > today),
	);
	const picks = record.picks.filter((pick) => {
		const leaves =
			isKnown(pick) ||
			(appearances[pickId(pick)] ?? 0) >= MAX_APPEARANCES ||
			daysSinceDay(pick.enteredOn, now) > MAX_DAYS_IN_POOL;
		if (leaves) {
			barred[pickId(pick)] = addDays(today, BARRED_DAYS);
		}
		return !leaves;
	});
	return { picks, barred };
}
