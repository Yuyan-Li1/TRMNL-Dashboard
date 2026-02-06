import type { DayType, TimeBlock, WidgetType } from "./index";

// Current schedule context (what should display now)
export interface ScheduleContext {
	dayType: DayType;
	timeBlock: TimeBlock;
	date: string; // YYYY-MM-DD
	time: string; // HH:mm
	dayOfWeek: number; // 0-6 (Sunday-Saturday)
	isHoliday: boolean;
	specialConditions: SpecialCondition[];
}

// Special conditions that affect widget display
export interface SpecialCondition {
	type:
		| "rain_expected"
		| "train_delay"
		| "hot_day"
		| "cold_day"
		| "meeting_soon";
	severity: "low" | "medium" | "high";
	message: string;
	data?: Record<string, unknown>;
}

// Widget display configuration for current context
export interface WidgetDisplay {
	type: WidgetType;
	priority: number;
	size: "small" | "medium" | "large" | "full";
	config?: Record<string, unknown>;
}

// Time block definition with buffer consideration
export interface TimeBlockDefinition {
	name: TimeBlock;
	startTime: string; // HH:mm
	endTime: string; // HH:mm
	displayStart: string; // HH:mm - when to START showing (with buffer)
	displayEnd: string; // HH:mm - when to STOP showing (with buffer)
}

// Schedule configuration
export interface ScheduleConfig {
	refreshIntervalMinutes: number; // TRMNL refresh interval
	bufferMinutes: number; // How early to show content
	timezone: string;
}
