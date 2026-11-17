import type { DashboardData } from "@/lib/api/refresh";
import { CACHE_KEYS, cacheGet } from "@/lib/cache/redis";
import type { GamingData } from "@/types/gaming";

export interface DashboardRenderData {
	gaming: GamingData | null;
	refreshedAt: string | null;
}

/**
 * Load the cached data the dashboard page renders from.
 * Never calls a source: falls back to the non-expiring `:latest` copy.
 */
export async function loadDashboardData(): Promise<DashboardRenderData> {
	const cached =
		(await cacheGet<DashboardData>(CACHE_KEYS.DASHBOARD_DATA)) ??
		(await cacheGet<DashboardData>(`${CACHE_KEYS.DASHBOARD_DATA}:latest`));

	return {
		gaming: cached?.gaming ?? null,
		refreshedAt: cached?.refreshedAt ?? null,
	};
}
