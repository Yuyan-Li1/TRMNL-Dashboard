import { LOCATION, TRMNL } from "@/lib/config";
import { Schedule } from "@/lib/db/models/schedule";
import { connectToDatabase } from "@/lib/db/mongodb";
import {
	applyBuffer,
	formatDate,
	formatTime,
	getDayOfWeek,
	getNow,
	isWithinTimeRange,
} from "@/lib/utils/date";
import type { DayType, TimeBlock } from "@/types";
import type { CalendarData } from "@/types/calendar";
import type {
	ScheduleConfig,
	ScheduleContext,
	SpecialCondition,
} from "@/types/schedule";
import type { TransitData } from "@/types/transport";
import type { WeatherData } from "@/types/weather";

// Default schedule configuration
const DEFAULT_CONFIG: ScheduleConfig = {
	refreshIntervalMinutes: TRMNL.refreshIntervalMinutes,
	bufferMinutes: TRMNL.bufferMinutes,
	timezone: LOCATION.timezone,
};

// Default time block definitions
const DEFAULT_TIME_BLOCKS: Record<
	DayType,
	{ name: TimeBlock; start: string; end: string }[]
> = {
	office: [
		{ name: "morning", start: "06:00", end: "09:00" },
		{ name: "workday", start: "09:00", end: "18:00" },
		{ name: "evening", start: "18:00", end: "22:00" },
		{ name: "night", start: "22:00", end: "06:00" },
	],
	wfh: [
		{ name: "morning", start: "07:00", end: "09:00" },
		{ name: "workday", start: "09:00", end: "18:00" },
		{ name: "evening", start: "18:00", end: "22:00" },
		{ name: "night", start: "22:00", end: "07:00" },
	],
	weekend: [
		{ name: "morning", start: "08:00", end: "12:00" },
		{ name: "workday", start: "12:00", end: "18:00" }, // "Daytime" on weekends
		{ name: "evening", start: "18:00", end: "23:00" },
		{ name: "night", start: "23:00", end: "08:00" },
	],
};

/**
 * Determine day type based on day of week and schedule configuration
 */
export async function getDayType(
	dayOfWeek: number = getDayOfWeek(),
): Promise<DayType> {
	try {
		await connectToDatabase();

		// Find schedule that includes this day
		const schedule = await Schedule.findOne({
			daysOfWeek: dayOfWeek,
			isActive: true,
		});

		if (schedule) {
			return schedule.dayType;
		}
	} catch (error) {
		console.error("Error fetching schedule:", error);
	}

	// Default fallback
	if (dayOfWeek === 0 || dayOfWeek === 6) {
		return "weekend";
	}
	if (dayOfWeek === 4 || dayOfWeek === 5) {
		return "wfh";
	}
	return "office";
}

/**
 * Determine current time block based on time and day type
 */
export function getCurrentTimeBlock(
	dayType: DayType,
	config: ScheduleConfig = DEFAULT_CONFIG,
): TimeBlock {
	const now = getNow(config.timezone);
	const timeBlocks = DEFAULT_TIME_BLOCKS[dayType];

	for (const block of timeBlocks) {
		// Apply buffer to start time (show content earlier)
		const bufferedStart = applyBuffer(block.start, config.bufferMinutes);

		if (isWithinTimeRange(now, bufferedStart, block.end, config.timezone)) {
			return block.name;
		}
	}

	// Default to night if no match
	return "night";
}

/**
 * Get the current schedule context
 */
export async function getScheduleContext(
	config: ScheduleConfig = DEFAULT_CONFIG,
): Promise<ScheduleContext> {
	const now = getNow(config.timezone);
	const dayOfWeek = now.getDay();
	const dayType = await getDayType(dayOfWeek);
	const timeBlock = getCurrentTimeBlock(dayType, config);

	// Get special conditions
	const specialConditions = await getSpecialConditions(dayType, timeBlock);

	return {
		dayType,
		timeBlock,
		date: formatDate(now),
		time: formatTime(now),
		dayOfWeek,
		isHoliday: false, // TODO: Implement holiday detection
		specialConditions,
	};
}

/**
 * Detect special conditions that affect widget display
 */
async function getSpecialConditions(
	dayType: DayType,
	timeBlock: TimeBlock,
): Promise<SpecialCondition[]> {
	const conditions: SpecialCondition[] = [];

	// Import dynamically to avoid circular dependencies
	const { cacheGet, CACHE_KEYS } = await import("@/lib/cache/redis");
	const { isRainExpected } = await import("@/lib/api/weather");
	const { hasSignificantDelays } = await import("@/lib/api/transport");
	const { hasMeetingSoon } = await import("@/lib/api/calendar");

	try {
		// Check weather conditions
		const weather = await cacheGet<WeatherData>(CACHE_KEYS.WEATHER);
		if (weather && isRainExpected(weather)) {
			conditions.push({
				type: "rain_expected",
				severity: "medium",
				message: "Rain expected - bring umbrella",
			});
		}

		// Check for hot/cold days
		if (weather?.current) {
			if (weather.current.temperature >= 35) {
				conditions.push({
					type: "hot_day",
					severity: "high",
					message: `Hot day: ${weather.current.temperature}\u00B0C`,
				});
			} else if (weather.current.temperature <= 10) {
				conditions.push({
					type: "cold_day",
					severity: "medium",
					message: `Cold day: ${weather.current.temperature}\u00B0C`,
				});
			}
		}

		// Check transit delays (only for office days in morning)
		if (dayType === "office" && timeBlock === "morning") {
			const transit = await cacheGet<TransitData>(CACHE_KEYS.TRANSIT);
			if (transit && hasSignificantDelays(transit)) {
				conditions.push({
					type: "train_delay",
					severity: "high",
					message: "Train delays detected",
					data: { departures: transit.departures },
				});
			}
		}

		// Check for upcoming meetings (during workday)
		if (timeBlock === "workday") {
			const calendar = await cacheGet<CalendarData>(CACHE_KEYS.CALENDAR);
			if (calendar) {
				const meeting = hasMeetingSoon(calendar, 30);
				if (meeting) {
					conditions.push({
						type: "meeting_soon",
						severity: "medium",
						message: `Meeting in 30 min: ${meeting.title}`,
						data: { event: meeting },
					});
				}
			}
		}
	} catch (error) {
		console.error("Error checking special conditions:", error);
	}

	return conditions;
}
