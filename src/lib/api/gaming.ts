import { mergePlays } from "@/lib/games/titles";
import { getPoster } from "@/lib/poster/poster";
import type { Game, GameTitle, GamingData, PlatformPlay } from "@/types/gaming";
import { lookupGame } from "./igdb";
import { getPlayStationPlays } from "./playstation";
import { getSteamPlays } from "./steam";
import { getSwitchPlays } from "./switch";
import { getXboxPlays } from "./xbox";

/** A game is In progress when it was played within this many days. */
export const IN_PROGRESS_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;
/** How many Titles get Catalog data and posters on a refresh. */
const MAX_DETAILED = 8;
/** With nothing In progress, this many of the latest Titles are prepared. */
const FALLBACK_DETAILED = 3;

const SOURCES = [
	{ name: "Steam", getPlays: getSteamPlays },
	{ name: "Xbox", getPlays: getXboxPlays },
	{ name: "PlayStation", getPlays: getPlayStationPlays },
	{ name: "Switch", getPlays: getSwitchPlays },
] as const;

function isInProgress(title: GameTitle, now: number): boolean {
	return (
		title.lastPlayedAt !== undefined &&
		now - new Date(title.lastPlayedAt).getTime() <= IN_PROGRESS_DAYS * DAY_MS
	);
}

/**
 * Add the Catalog's description and rating to a Title and make its posters.
 * Artwork is looked for in the Catalog first, then in the source. A failure
 * here leaves the Title without that detail; it never fails the refresh.
 */
async function addDetail(
	title: GameTitle,
	withThumbnail: boolean,
	errors: string[],
): Promise<Game> {
	const game: Game = { ...title };

	let coverUrl: string | undefined;
	try {
		const catalog = await lookupGame(title);
		game.description = catalog?.description;
		game.publicRating = catalog?.rating;
		coverUrl = catalog?.coverUrl;
	} catch (error) {
		errors.push(`IGDB (${title.name}): ${error}`);
	}

	const candidates = [coverUrl, title.imageUrl].filter((url): url is string =>
		Boolean(url),
	);
	for (const url of candidates) {
		try {
			await getPoster(url, "spotlight");
			game.posterUrl = url;
			if (withThumbnail) {
				await getPoster(url, "thumbnail");
				game.thumbnailUrl = url;
			}
			break;
		} catch (error) {
			errors.push(`Artwork (${title.name}): ${error}`);
		}
	}

	return game;
}

/**
 * Read every game source, merge the plays into one Title per game, and
 * prepare the Titles the screen can show.
 */
export async function getGamingData(): Promise<GamingData> {
	const errors: string[] = [];

	const results = await Promise.allSettled(
		SOURCES.map((source) => source.getPlays()),
	);
	const plays: PlatformPlay[] = [];
	results.forEach((result, index) => {
		if (result.status === "fulfilled") {
			plays.push(...result.value);
		} else {
			errors.push(`${SOURCES[index].name}: ${result.reason}`);
		}
	});
	if (plays.length === 0 && errors.length === SOURCES.length) {
		throw new Error(`Every game source failed: ${errors.join("; ")}`);
	}

	const titles = mergePlays(plays);
	const now = Date.now();
	const inProgress = titles.filter((title) => isInProgress(title, now));
	const detailed = new Set(
		(inProgress.length > 0
			? inProgress.slice(0, MAX_DETAILED)
			: titles.slice(0, FALLBACK_DETAILED)
		).map((title) => title.id),
	);

	// One at a time: IGDB allows 4 requests per second
	const games: Game[] = [];
	for (const [index, title] of titles.entries()) {
		games.push(
			detailed.has(title.id)
				? // Only the latest Title can appear on the games Medium card
					await addDetail(title, index === 0, errors)
				: title,
		);
	}

	return { games, errors, fetchedAt: new Date(now).toISOString() };
}
