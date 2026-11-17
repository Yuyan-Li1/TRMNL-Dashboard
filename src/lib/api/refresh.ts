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

	const [gaming, movies] = await Promise.all([
		read("Gaming", getGamingData, (data) => data.gaming),
		read("Movies", getMoviesData, (data) => data.movies),
	]);

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
	);

	return dashboardData;
}
