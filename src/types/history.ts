/**
 * Each source's full history, written by Vercel's daily run and read by the
 * Collector, which merges it into the consumed set. This file imports
 * nothing, so either side can load it.
 */

export const HISTORY_SOURCES = [
	"steam",
	"xbox",
	"psn",
	"switch",
	"trakt",
	"letterboxd",
] as const;
export type HistorySource = (typeof HISTORY_SOURCES)[number];

/** Vercel's key for one source's full history. It has no TTL. */
export function historyKey(source: HistorySource): string {
	return `history:${source}`;
}

/** One game in a game source's full history, as the source names it. */
export interface HistoryGame {
	name: string;
	/** Absent when the source records no play time for the game */
	minutesPlayed?: number;
	/** Trophies or achievements earned, where the source says */
	achievements?: number;
	/** In the owner's library. Ownership is known for Steam only */
	owned?: boolean;
	/** Steam app id, for matching the game in IGDB */
	steamAppId?: string;
}

/** One movie or show in a source's full history. */
export interface HistoryTitle {
	/** The TMDB id, which the source supplies */
	tmdbId: string;
	title: string;
	year?: number;
}

/** The value of a history key. */
export interface SourceHistory<T> {
	titles: T[];
	/** When the source was read */
	readAt: string;
}
