import { google } from "googleapis";
import { CACHE_KEYS, CACHE_TTL, cacheGet, cacheSet } from "@/lib/cache/redis";
import type { CalendarData, CalendarEvent } from "@/types/calendar";

const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY?.replace(
	/\\n/g,
	"\n",
);
const GOOGLE_CALENDAR_ID = process.env.GOOGLE_CALENDAR_ID;

function getCalendarClient() {
	if (!GOOGLE_CLIENT_EMAIL || !GOOGLE_PRIVATE_KEY || !GOOGLE_CALENDAR_ID) {
		throw new Error("Google Calendar credentials not configured");
	}

	const auth = new google.auth.JWT({
		email: GOOGLE_CLIENT_EMAIL,
		key: GOOGLE_PRIVATE_KEY,
		scopes: ["https://www.googleapis.com/auth/calendar.readonly"],
	});

	return google.calendar({ version: "v3", auth });
}

async function fetchEventsFromAPI(daysAhead = 7): Promise<CalendarEvent[]> {
	const calendar = getCalendarClient();

	const now = new Date();
	const endDate = new Date();
	endDate.setDate(endDate.getDate() + daysAhead);

	const response = await calendar.events.list({
		calendarId: GOOGLE_CALENDAR_ID,
		timeMin: now.toISOString(),
		timeMax: endDate.toISOString(),
		singleEvents: true,
		orderBy: "startTime",
		maxResults: 50,
	});

	const events = response.data.items || [];

	return events.map(
		(event): CalendarEvent => ({
			id: event.id || "",
			title: event.summary || "Untitled Event",
			description: event.description ?? undefined,
			location: event.location ?? undefined,
			startTime: event.start?.dateTime || event.start?.date || "",
			endTime: event.end?.dateTime || event.end?.date || "",
			isAllDay: !event.start?.dateTime,
			status: (event.status as CalendarEvent["status"]) || "confirmed",
			colorId: event.colorId ?? undefined,
		}),
	);
}

/**
 * Get calendar events with caching
 */
export async function getCalendarEvents(daysAhead = 7): Promise<CalendarData> {
	const cached = await cacheGet<CalendarData>(CACHE_KEYS.CALENDAR);
	if (cached) {
		return cached;
	}

	const events = await fetchEventsFromAPI(daysAhead);

	const data: CalendarData = {
		calendarName: GOOGLE_CALENDAR_ID || "Calendar",
		events,
		fetchedAt: new Date().toISOString(),
	};

	await cacheSet(CACHE_KEYS.CALENDAR, data, CACHE_TTL.CALENDAR);
	return data;
}

/**
 * Get today's events
 */
export function getTodayEvents(calendar: CalendarData): CalendarEvent[] {
	const today = new Date().toISOString().split("T")[0];

	return calendar.events.filter((event) => {
		const eventDate = event.startTime.split("T")[0];
		return eventDate === today;
	});
}

/**
 * Get upcoming events in the next N hours
 */
export function getUpcomingEvents(
	calendar: CalendarData,
	hoursAhead = 4,
): CalendarEvent[] {
	const now = new Date();
	const cutoff = new Date(now.getTime() + hoursAhead * 60 * 60 * 1000);

	return calendar.events.filter((event) => {
		const startTime = new Date(event.startTime);
		return startTime >= now && startTime <= cutoff;
	});
}

/**
 * Check if there's a meeting soon
 */
export function hasMeetingSoon(
	calendar: CalendarData,
	minutesAhead = 30,
): CalendarEvent | null {
	const now = new Date();
	const cutoff = new Date(now.getTime() + minutesAhead * 60 * 1000);

	return (
		calendar.events.find((event) => {
			if (event.isAllDay) return false;
			const startTime = new Date(event.startTime);
			return startTime >= now && startTime <= cutoff;
		}) || null
	);
}

/**
 * Format event time for display
 */
export function formatEventTime(event: CalendarEvent): string {
	if (event.isAllDay) return "All day";

	const start = new Date(event.startTime);
	const end = new Date(event.endTime);

	const timeFormat: Intl.DateTimeFormatOptions = {
		hour: "numeric",
		minute: "2-digit",
		hour12: true,
	};

	return `${start.toLocaleTimeString("en-AU", timeFormat)} - ${end.toLocaleTimeString("en-AU", timeFormat)}`;
}
