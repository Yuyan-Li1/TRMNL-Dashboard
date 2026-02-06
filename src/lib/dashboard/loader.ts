import type { DashboardData } from "@/lib/api/refresh";
import { CACHE_KEYS, cacheGet } from "@/lib/cache/redis";
import { getScheduleContext } from "@/lib/schedule/context";
import {
	getActiveRoutine,
	getMedicationRoutines,
	getWidgetsForContext,
} from "@/lib/schedule/widgets";
import type { CalendarData } from "@/types/calendar";
import type { GamingData } from "@/types/gaming";
import type { ScheduleContext, WidgetDisplay } from "@/types/schedule";
import type { TransitData } from "@/types/transport";
import type { WeatherData } from "@/types/weather";

export interface DashboardRenderData {
	context: ScheduleContext;
	widgets: WidgetDisplay[];
	routine: { name: string; steps: string[] } | null;
	medications: Array<{
		name: string;
		dosage?: string;
		time?: string;
		notes?: string;
	}>;
	data: {
		weather: WeatherData | null;
		transit: TransitData | null;
		calendar: CalendarData | null;
		gaming: GamingData | null;
	};
	meta: {
		renderedAt: string;
		dataAge: string | null;
	};
}

/**
 * Load all data needed to render the dashboard
 * This is called on every page render (server-side)
 */
export async function loadDashboardData(): Promise<DashboardRenderData> {
	// Get schedule context
	const context = await getScheduleContext();

	// Get widgets for this context
	const widgets = await getWidgetsForContext(context);

	// Get active routine and medication data
	const [routine, medications] = await Promise.all([
		getActiveRoutine(context),
		getMedicationRoutines(context),
	]);

	// Get cached data (don't fetch fresh - that's done by the refresh cron)
	const cachedData = await cacheGet<DashboardData>(CACHE_KEYS.DASHBOARD_DATA);

	const weather =
		cachedData?.weather || (await cacheGet<WeatherData>(CACHE_KEYS.WEATHER));
	const transit =
		cachedData?.transit || (await cacheGet<TransitData>(CACHE_KEYS.TRANSIT));
	const calendar =
		cachedData?.calendar || (await cacheGet<CalendarData>(CACHE_KEYS.CALENDAR));
	const gaming = cachedData?.gaming ?? null;

	// Calculate data age
	const dataAge = cachedData?.refreshedAt
		? getDataAgeString(cachedData.refreshedAt)
		: null;

	return {
		context,
		widgets,
		routine,
		medications,
		data: {
			weather,
			transit,
			calendar,
			gaming,
		},
		meta: {
			renderedAt: new Date().toISOString(),
			dataAge,
		},
	};
}

/**
 * Format data age for display
 */
function getDataAgeString(refreshedAt: string): string {
	const refreshedTime = new Date(refreshedAt);
	const now = new Date();
	const diffMinutes = Math.floor(
		(now.getTime() - refreshedTime.getTime()) / 60000,
	);

	if (diffMinutes < 1) return "Just now";
	if (diffMinutes < 60) return `${diffMinutes}m ago`;

	const diffHours = Math.floor(diffMinutes / 60);
	if (diffHours < 24) return `${diffHours}h ago`;

	return `${Math.floor(diffHours / 24)}d ago`;
}
