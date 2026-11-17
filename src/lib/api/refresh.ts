import {
	CACHE_KEYS,
	CACHE_TTL,
	cacheGetLatest,
	cacheSet,
} from "@/lib/cache/redis";
import type { GamingData } from "@/types/gaming";
import { getGamingData } from "./gaming";

export interface DashboardData {
	gaming: GamingData | null;
	errors: string[];
	refreshedAt: string;
}

/**
 * Refresh every source and store the combined result in Redis.
 * Called by the refresh API endpoints.
 */
export async function refreshAllData(): Promise<DashboardData> {
	const errors: string[] = [];
	let gaming: GamingData | null = null;

	try {
		gaming = await getGamingData();
		errors.push(...gaming.errors);
	} catch (error) {
		errors.push(`Gaming: ${error}`);
		console.error("Gaming fetch failed:", error);
		// Keep the last good games on screen: stale but never missing
		const lastGood = await cacheGetLatest<DashboardData>(
			CACHE_KEYS.DASHBOARD_DATA,
		).catch(() => null);
		gaming = lastGood?.gaming ?? null;
	}

	const dashboardData: DashboardData = {
		gaming,
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
