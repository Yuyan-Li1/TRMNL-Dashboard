import { getRedis } from "@/lib/cache/redis";
import type { PlatformPlay } from "@/types/gaming";
import {
	type HistoryGame,
	type HistorySource,
	type HistoryTitle,
	historyKey,
	type SourceHistory,
} from "@/types/history";
import { getDiaryEntries } from "./letterboxd";
import { getPlayStationHistory } from "./playstation";
import { getSteamLibrary } from "./steam";
import { getSwitchPlays } from "./switch";
import { getWatchedShowsHistory } from "./trakt";
import { getXboxPlays } from "./xbox";

/** A source's plays, which are already its whole history, as history games. */
function fromPlays(plays: PlatformPlay[]): HistoryGame[] {
	return plays.map((play) => {
		const game: HistoryGame = { name: play.name };
		if (play.minutesPlayed !== undefined) {
			game.minutesPlayed = play.minutesPlayed;
		}
		return game;
	});
}

/** The owner's feed: its diary entries that are movies on TMDB. */
async function getDiaryHistory(): Promise<HistoryTitle[]> {
	const titles = new Map<string, HistoryTitle>();
	for (const entry of await getDiaryEntries()) {
		if (!entry.tmdbId || titles.has(entry.tmdbId)) {
			continue;
		}
		const title: HistoryTitle = { tmdbId: entry.tmdbId, title: entry.title };
		if (entry.year !== undefined) {
			title.year = entry.year;
		}
		titles.set(entry.tmdbId, title);
	}
	return [...titles.values()];
}

/**
 * How each source's full history is read. Xbox's one unpaged call and
 * Nintendo's play history are what the 15-minute refresh already reads, so
 * their plays are reused; Xbox reports no play time.
 */
const READERS: Record<
	HistorySource,
	() => Promise<(HistoryGame | HistoryTitle)[]>
> = {
	steam: getSteamLibrary,
	xbox: async () => fromPlays(await getXboxPlays()),
	psn: getPlayStationHistory,
	switch: async () => fromPlays(await getSwitchPlays()),
	trakt: getWatchedShowsHistory,
	letterboxd: getDiaryHistory,
};

/**
 * Write each source's full history to its own Redis key, for the Collector
 * to merge into the consumed set. A source that fails keeps the history it
 * had. Returns one line per failure.
 */
export async function writeFullHistories(): Promise<string[]> {
	const redis = getRedis();
	const errors: string[] = [];
	await Promise.all(
		Object.entries(READERS).map(async ([source, read]) => {
			try {
				const history: SourceHistory<HistoryGame | HistoryTitle> = {
					titles: await read(),
					readAt: new Date().toISOString(),
				};
				await redis.set(historyKey(source as HistorySource), history);
			} catch (error) {
				errors.push(`History (${source}): ${error}`);
				console.error(`Full history of ${source} failed:`, error);
			}
		}),
	);
	return errors;
}
