export const TRMNL = {
	width: 800,
	height: 480,
	refreshIntervalMinutes: 15,
} as const;

/**
 * Where the owner's day starts and ends. A Letterboxd diary entry carries a
 * watched date with no time or zone, so "today" and "yesterday" are read in
 * this zone.
 */
export const OWNER_TIME_ZONE = "Australia/Sydney";
