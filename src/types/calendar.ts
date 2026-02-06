export interface CalendarEvent {
	id: string;
	title: string;
	description?: string;
	location?: string;
	startTime: string; // ISO timestamp
	endTime: string; // ISO timestamp
	isAllDay: boolean;
	status: "confirmed" | "tentative" | "cancelled";
	colorId?: string;
}

export interface CalendarData {
	calendarName: string;
	events: CalendarEvent[];
	fetchedAt: string;
}

// Google Calendar color IDs to hex colors
export const CALENDAR_COLORS: Record<string, string> = {
	"1": "#7986CB", // Lavender
	"2": "#33B679", // Sage
	"3": "#8E24AA", // Grape
	"4": "#E67C73", // Flamingo
	"5": "#F6BF26", // Banana
	"6": "#F4511E", // Tangerine
	"7": "#039BE5", // Peacock
	"8": "#616161", // Graphite
	"9": "#3F51B5", // Blueberry
	"10": "#0B8043", // Basil
	"11": "#D50000", // Tomato
};
