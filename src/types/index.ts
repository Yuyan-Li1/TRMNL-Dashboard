// Day types for schedule system
export const DAY_TYPES = ["office", "wfh", "weekend"] as const;
export type DayType = (typeof DAY_TYPES)[number];

// Time blocks throughout the day
export const TIME_BLOCKS = ["morning", "workday", "evening", "night"] as const;
export type TimeBlock = (typeof TIME_BLOCKS)[number];

// Widget types available in the dashboard
export const WIDGET_TYPES = [
	"weather",
	"transit",
	"calendar",
	"gaming",
	"routine",
	"medication",
] as const;
export type WidgetType = (typeof WIDGET_TYPES)[number];

// Token health status
export const TOKEN_STATUSES = [
	"healthy",
	"expiring_soon",
	"expired",
	"error",
] as const;
export type TokenStatus = (typeof TOKEN_STATUSES)[number];

// Service identifiers for token tracking
export const SERVICES = ["psn", "xbox", "steam", "google", "tfnsw"] as const;
export type Service = (typeof SERVICES)[number];
