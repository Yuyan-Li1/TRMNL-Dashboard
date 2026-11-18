import {
	CACHE_KEYS,
	CACHE_TTL,
	cacheGetOrLatest,
	getRedis,
} from "@/lib/cache/redis";
import { type ConsumedSet, consumedKey, isConsumed } from "@/lib/consumed/set";
import { ownerDay } from "@/lib/owner-day";
import {
	CATALOG_PICKS_PER_MEDIUM,
	choosePicks,
	isBarred,
	type PickTitle,
	type PoolPick,
	type PoolRecord,
	type PoolTitles,
	pickId,
	reasonFor,
	retirePicks,
	seedGames,
	seedMovies,
	seedShows,
} from "@/lib/picks/pool";
import { getPoster } from "@/lib/poster/poster";
import type { Medium } from "@/lib/screen/types";
import { getSimilarGames, lookupGame } from "./igdb";
import type { DashboardData } from "./refresh";
import { getRecommendations, lookupMovie, lookupShow } from "./tmdb";

/** The Media that get Catalog picks. Books get Recommendations from the LLM only. */
const CATALOG_PICK_MEDIA = ["movie", "show", "game"] as const;
type CatalogPickMedium = (typeof CATALOG_PICK_MEDIA)[number];

type TitleSet = Pick<ConsumedSet, "ids" | "names">;

const EMPTY_RECORD: PoolRecord = { picks: [], barred: {} };

/** The Titles of one Medium in the owner's activity, as a set to check against. */
function activity(data: DashboardData, medium: Medium): TitleSet {
	if (medium === "movie") {
		const ids = (data.movies?.movies ?? []).flatMap((movie) =>
			movie.tmdbId ? [movie.tmdbId] : [],
		);
		return { ids, names: [] };
	}
	if (medium === "show") {
		const ids = (data.shows?.shows ?? []).flatMap((show) =>
			show.tmdbId === undefined ? [] : [String(show.tmdbId)],
		);
		return { ids, names: [] };
	}
	if (medium === "game") {
		const games = data.gaming?.games ?? [];
		return {
			ids: games.flatMap((game) =>
				game.igdbId === undefined ? [] : [String(game.igdbId)],
			),
			// A game Title's id is its name key
			names: games.map((game) => game.id),
		};
	}
	return { ids: [], names: [] };
}

/**
 * What the owner is known to have Consumed in each Medium: the consumed set
 * the Collector published, where it has, with the activity on screen, which
 * can be up to a tick ahead of it.
 */
async function knownTitles(
	data: DashboardData,
	media: readonly Medium[],
): Promise<Map<Medium, { known: TitleSet; published: boolean }>> {
	const redis = getRedis();
	const entries = await Promise.all(
		media.map(async (medium) => {
			const consumed = await redis.get<ConsumedSet>(consumedKey(medium));
			const active = activity(data, medium);
			const known: TitleSet = {
				ids: [...(consumed?.ids ?? []), ...active.ids],
				names: [...(consumed?.names ?? []), ...active.names],
			};
			return [medium, { known, published: consumed !== null }] as const;
		}),
	);
	return new Map(entries);
}

/** Each pick's count of Spotlight appearances, by `pickId`. */
async function readAppearances(): Promise<Record<string, number>> {
	const counts = await getRedis().hgetall<Record<string, number | string>>(
		CACHE_KEYS.POOL_APPEARANCES,
	);
	return Object.fromEntries(
		Object.entries(counts ?? {}).map(([id, count]) => [id, Number(count)]),
	);
}

/**
 * Retire the picks that are due to leave the Pool and store the record.
 * Runs at every refresh and before the daily rebuild. A pick leaves once its
 * Title is in the owner's activity or in the consumed set (adding a Title
 * to an "also consumed" file is how the owner rejects a pick), after 3
 * Spotlight appearances, or after 30 days.
 */
export async function retirePoolPicks(
	data: DashboardData,
	now = new Date(),
): Promise<PoolRecord> {
	const redis = getRedis();
	const record =
		(await redis.get<PoolRecord>(CACHE_KEYS.POOL_RECORD)) ?? EMPTY_RECORD;
	if (record.picks.length === 0 && Object.keys(record.barred).length === 0) {
		return record;
	}

	const [appearances, titles, known] = await Promise.all([
		readAppearances(),
		redis.get<PoolTitles>(CACHE_KEYS.POOL_TITLES),
		knownTitles(data, [...new Set(record.picks.map((pick) => pick.medium))]),
	]);
	const after = retirePicks(record, {
		appearances,
		isKnown: (pick) => {
			const set = known.get(pick.medium)?.known;
			return (
				set !== undefined &&
				isConsumed(set, pick.medium, {
					catalogId: pick.catalogId,
					title: titles?.[pickId(pick)]?.title ?? "",
				})
			);
		},
		now,
	});

	const kept = new Set(after.picks.map(pickId));
	const gone = [
		...record.picks.map(pickId),
		...Object.keys(appearances),
	].filter((id) => !kept.has(id));
	if (
		gone.length > 0 ||
		Object.keys(after.barred).length !== Object.keys(record.barred).length
	) {
		await redis.set(CACHE_KEYS.POOL_RECORD, after);
		if (gone.length > 0) {
			await redis.hdel(CACHE_KEYS.POOL_APPEARANCES, ...new Set(gone));
		}
	}
	return after;
}

/** How one Medium's Catalog picks are found. */
interface Picker<Seed, Result extends { catalogId: string; title?: string }> {
	medium: CatalogPickMedium;
	/** Newest first */
	seeds: Seed[];
	seedTitle(seed: Seed): string;
	/** What the Catalog suggests for a seed, best first */
	resultsOf(seed: Seed): Promise<Result[]>;
	/** What the Catalog says about a result; null when it has no artwork */
	titleOf(result: Result): Promise<PickTitle | null>;
	/** How long the poster may be kept, where the Catalog limits it */
	posterTtl?: number;
}

function moviePicker(
	data: DashboardData,
	now: Date,
): Picker<{ tmdbId: string; title: string }, { catalogId: string }> {
	return {
		medium: "movie",
		seeds: seedMovies(data.movies?.movies ?? [], now),
		seedTitle: (seed) => seed.title,
		resultsOf: async (seed) =>
			(await getRecommendations("movie", seed.tmdbId)).map((catalogId) => ({
				catalogId,
			})),
		titleOf: async ({ catalogId }) => {
			const movie = await lookupMovie(catalogId);
			if (!movie?.title || !movie.posterUrl) {
				return null;
			}
			return {
				title: movie.title,
				year: movie.year,
				director: movie.director,
				description: movie.overview,
				publicRating: movie.rating,
				posterUrl: movie.posterUrl,
			};
		},
		// TMDB's artwork may not be kept for ever
		posterTtl: CACHE_TTL.TMDB_DERIVED,
	};
}

function showPicker(
	data: DashboardData,
	now: Date,
): Picker<{ tmdbId: number; title: string }, { catalogId: string }> {
	return {
		medium: "show",
		seeds: seedShows(data.shows?.shows ?? [], now),
		seedTitle: (seed) => seed.title,
		resultsOf: async (seed) =>
			(await getRecommendations("show", seed.tmdbId)).map((catalogId) => ({
				catalogId,
			})),
		titleOf: async ({ catalogId }) => {
			const show = await lookupShow(Number(catalogId));
			if (!show?.title || !show.posterUrl) {
				return null;
			}
			return {
				title: show.title,
				year: show.year,
				description: show.overview,
				publicRating: show.rating,
				posterUrl: show.posterUrl,
			};
		},
		posterTtl: CACHE_TTL.TMDB_DERIVED,
	};
}

function gamePicker(
	data: DashboardData,
	now: Date,
): Picker<
	ReturnType<typeof seedGames>[number],
	PickTitle & { catalogId: string }
> {
	return {
		medium: "game",
		seeds: seedGames(data.gaming?.games ?? [], now),
		seedTitle: (seed) => seed.name,
		resultsOf: async (seed) => {
			// Only the Titles prepared for the screen carry their IGDB id
			const igdbId = seed.igdbId ?? (await lookupGame(seed))?.id;
			if (igdbId === undefined) {
				return [];
			}
			return (await getSimilarGames(igdbId)).flatMap((game) =>
				game.id === undefined || !game.coverUrl
					? []
					: [
							{
								catalogId: String(game.id),
								title: game.name,
								platforms: game.platforms,
								description: game.description,
								publicRating: game.rating,
								posterUrl: game.coverUrl,
							},
						],
			);
		},
		titleOf: async ({ catalogId: _, ...title }) => title,
	};
}

/**
 * Fill one Medium's share of the Pool up to 5 Catalog picks. With no
 * published consumed set there is nothing to check a pick against, so none
 * is made.
 */
async function fillMedium<
	Seed,
	Result extends { catalogId: string; title?: string },
>(
	picker: Picker<Seed, Result>,
	record: PoolRecord,
	known: { known: TitleSet; published: boolean } | undefined,
	now: Date,
	errors: string[],
): Promise<{ pick: PoolPick; title: PickTitle }[]> {
	const { medium } = picker;
	const held = record.picks.filter(
		(pick) => pick.medium === medium && pick.origin === "catalog",
	).length;
	if (!known?.published || held >= CATALOG_PICKS_PER_MEDIUM) {
		return [];
	}
	const inPool = new Set(record.picks.map(pickId));
	const enteredOn = ownerDay(now);

	const chosen = await choosePicks({
		seeds: picker.seeds,
		wanted: CATALOG_PICKS_PER_MEDIUM - held,
		resultsOf: async (seed) => {
			try {
				return await picker.resultsOf(seed);
			} catch (error) {
				errors.push(`Picks (${picker.seedTitle(seed)}): ${error}`);
				return [];
			}
		},
		isExcluded: (result) =>
			inPool.has(pickId({ medium, catalogId: result.catalogId })) ||
			isBarred(record, { medium, catalogId: result.catalogId }, now) ||
			isConsumed(known.known, medium, {
				catalogId: result.catalogId,
				title: result.title ?? "",
			}),
		accept: async (result) => {
			try {
				const title = await picker.titleOf(result);
				if (!title) {
					return null;
				}
				// A Title without artwork is not eligible for the Spotlight
				await getPoster(title.posterUrl, "spotlight", picker.posterTtl);
				return { catalogId: result.catalogId, title };
			} catch (error) {
				errors.push(`Picks (${medium} ${result.catalogId}): ${error}`);
				return null;
			}
		},
	});

	return chosen.map(({ seed, pick }) => ({
		pick: {
			medium,
			catalogId: pick.catalogId,
			origin: "catalog",
			reason: reasonFor(medium, picker.seedTitle(seed)),
			enteredOn,
		},
		title: pick.title,
	}));
}

export interface RebuildResult {
	/** How many Catalog picks each Medium gained */
	added: Record<CatalogPickMedium, number>;
	errors: string[];
}

/**
 * Rebuild the Catalog picks, once a day: retire the picks that are due to
 * leave, then fill each Medium back up to 5 from TMDB's recommendations
 * (movies and shows) and IGDB's similar games, seeded by what the owner
 * Finished or had In progress in the last 90 days.
 */
export async function rebuildCatalogPicks(
	now = new Date(),
): Promise<RebuildResult> {
	const result: RebuildResult = {
		added: { movie: 0, show: 0, game: 0 },
		errors: [],
	};
	const data = await cacheGetOrLatest<DashboardData>(CACHE_KEYS.DASHBOARD_DATA);
	if (!data) {
		result.errors.push("Picks: no dashboard data to seed them from");
		return result;
	}

	const redis = getRedis();
	const record = await retirePoolPicks(data, now);
	const [known, stored] = await Promise.all([
		knownTitles(data, CATALOG_PICK_MEDIA),
		redis.get<PoolTitles>(CACHE_KEYS.POOL_TITLES),
	]);
	const fill = <Seed, Result extends { catalogId: string; title?: string }>(
		picker: Picker<Seed, Result>,
	) => fillMedium(picker, record, known.get(picker.medium), now, result.errors);
	const added = (
		await Promise.all([
			fill(moviePicker(data, now)),
			fill(showPicker(data, now)),
			fill(gamePicker(data, now)),
		])
	).flat();
	for (const { pick } of added) {
		result.added[pick.medium as CatalogPickMedium] += 1;
	}

	const picks = [...record.picks, ...added.map(({ pick }) => pick)];
	const titles: PoolTitles = {};
	for (const pick of record.picks) {
		const title = stored?.[pickId(pick)];
		if (title) {
			titles[pickId(pick)] = title;
		}
	}
	for (const { pick, title } of added) {
		titles[pickId(pick)] = title;
	}
	// The titles first: a pick in the record with no title is never shown.
	// They hold TMDB's text, which may not be kept for ever.
	await redis.set(CACHE_KEYS.POOL_TITLES, titles, {
		ex: CACHE_TTL.TMDB_DERIVED,
	});
	await redis.set(CACHE_KEYS.POOL_RECORD, { ...record, picks });
	return result;
}
