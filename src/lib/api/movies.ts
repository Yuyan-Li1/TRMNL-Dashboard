import { CACHE_KEYS, cacheGetLatest } from "@/lib/cache/redis";
import type { DiaryEntry, MoviesData } from "@/types/movies";
import { getDiaryEntries } from "./letterboxd";

/**
 * Read the owner's diary. When Letterboxd fails it is Stale: its last good
 * entries stay on screen.
 */
export async function getMoviesData(): Promise<MoviesData> {
	const errors: string[] = [];

	let entries: DiaryEntry[];
	try {
		entries = await getDiaryEntries();
	} catch (error) {
		const lastGood = await cacheGetLatest<DiaryEntry[]>(
			CACHE_KEYS.MOVIES_LETTERBOXD,
		).catch(() => null);
		if (!lastGood) {
			throw error;
		}
		errors.push(`Letterboxd: ${error}`);
		entries = lastGood;
	}

	return { movies: entries, errors, fetchedAt: new Date().toISOString() };
}
