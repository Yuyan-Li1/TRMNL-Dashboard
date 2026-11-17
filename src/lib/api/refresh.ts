import {
	CACHE_KEYS,
	CACHE_TTL,
	cacheGetLatest,
	cacheSet,
} from "@/lib/cache/redis";
import type { GamingData } from "@/types/gaming";
import type { MoviesData } from "@/types/movies";
import { getGamingData } from "./gaming";
import { getMoviesData } from "./movies";

export interface DashboardData {
	gaming: GamingData | null;
	/** Absent in data stored before movies were read */
	movies?: MoviesData | null;
	errors: string[];
	refreshedAt: string;
}

/**
 * Refresh every source and store the combined result in Redis.
 * Called by the refresh API endpoints.
 */
export async function refreshAllData(): Promise<DashboardData> {
	const errors: string[] = [];
	let lastGood: Promise<DashboardData | null> | undefined;

	/**
	 * Read one Medium. When it fails altogether its last good data stays on
	 * screen: stale but never missing.
	 */
	async function read<T extends { errors: string[] }>(
		name: string,
		get: () => Promise<T>,
		stored: (data: DashboardData) => T | null | undefined,
	): Promise<T | null> {
		try {
			const data = await get();
			errors.push(...data.errors);
			return data;
		} catch (error) {
			errors.push(`${name}: ${error}`);
			console.error(`${name} fetch failed:`, error);
			lastGood ??= cacheGetLatest<DashboardData>(
				CACHE_KEYS.DASHBOARD_DATA,
			).catch(() => null);
			const data = await lastGood;
			return (data && stored(data)) ?? null;
		}
	}

	const [gaming, readMovies] = await Promise.all([
		read("Gaming", getGamingData, (data) => data.gaming),
		read("Movies", getMoviesData, (data) => data.movies),
	]);

	// TMDB's text may not be kept for ever. The copy that otherwise never
	// expires lives only as long as the movies in it may still be kept, and
	// movies carried over from the last good data are dropped once too old.
	let movies = readMovies;
	let latestTtlSeconds: number | undefined;
	if (movies) {
		const ageSeconds = Math.floor(
			(Date.now() - new Date(movies.fetchedAt).getTime()) / 1000,
		);
		latestTtlSeconds = CACHE_TTL.TMDB_DERIVED - ageSeconds;
		if (latestTtlSeconds <= 0) {
			movies = null;
			latestTtlSeconds = undefined;
		}
	}

	const dashboardData: DashboardData = {
		gaming,
		movies,
		errors,
		refreshedAt: new Date().toISOString(),
	};

	await cacheSet(
		CACHE_KEYS.DASHBOARD_DATA,
		dashboardData,
		CACHE_TTL.DASHBOARD_DATA,
		latestTtlSeconds,
	);

	return dashboardData;
}
