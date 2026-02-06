import { CACHE_KEYS, cacheSet } from "@/lib/cache/redis";
import type { CalendarData } from "@/types/calendar";
import type { GamingData } from "@/types/gaming";
import type { TransitData } from "@/types/transport";
import type { WeatherData } from "@/types/weather";
import { getCalendarEvents } from "./calendar";
import { getGamingData } from "./gaming";
import { getTransitDepartures } from "./transport";
import { getWeather } from "./weather";

export interface DashboardData {
	weather: WeatherData | null;
	transit: TransitData | null;
	calendar: CalendarData | null;
	gaming: GamingData | null;
	errors: string[];
	refreshedAt: string;
}

/**
 * Refresh all data sources
 * This is called by the refresh API endpoint (triggered by GitHub Actions)
 */
export async function refreshAllData(): Promise<DashboardData> {
	const errors: string[] = [];

	// Fetch all data in parallel
	const results = await Promise.allSettled([
		getWeather(),
		getTransitDepartures(),
		getCalendarEvents(),
		getGamingData(),
	]);

	const weather = results[0].status === "fulfilled" ? results[0].value : null;
	const transit = results[1].status === "fulfilled" ? results[1].value : null;
	const calendar = results[2].status === "fulfilled" ? results[2].value : null;
	const gaming = results[3].status === "fulfilled" ? results[3].value : null;

	// Collect errors
	if (results[0].status === "rejected") {
		errors.push(`Weather: ${results[0].reason}`);
		console.error("Weather fetch failed:", results[0].reason);
	}
	if (results[1].status === "rejected") {
		errors.push(`Transit: ${results[1].reason}`);
		console.error("Transit fetch failed:", results[1].reason);
	}
	if (results[2].status === "rejected") {
		errors.push(`Calendar: ${results[2].reason}`);
		console.error("Calendar fetch failed:", results[2].reason);
	}
	if (results[3].status === "rejected") {
		errors.push(`Gaming: ${results[3].reason}`);
		console.error("Gaming fetch failed:", results[3].reason);
	}

	// Also include gaming-specific errors
	if (gaming?.errors) {
		errors.push(...gaming.errors);
	}

	const dashboardData: DashboardData = {
		weather,
		transit,
		calendar,
		gaming,
		errors,
		refreshedAt: new Date().toISOString(),
	};

	// Cache combined data
	await cacheSet(CACHE_KEYS.DASHBOARD_DATA, dashboardData, 15 * 60);

	return dashboardData;
}

// Re-export for backwards compatibility
export { refreshAllData as refreshCoreData };
