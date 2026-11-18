import { OWNER_TIME_ZONE } from "@/lib/config";
import { DAY_MS } from "@/lib/time";

/** A movie is eligible for the Spotlight for this many days from its watched date. */
export const RECENTLY_WATCHED_DAYS = 14;

const ownerDay = new Intl.DateTimeFormat("en-CA", {
	timeZone: OWNER_TIME_ZONE,
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
});

function dayNumber(day: string): number {
	return Math.round(new Date(`${day}T00:00:00Z`).getTime() / DAY_MS);
}

/**
 * Whole calendar days from a diary entry's watched date to today, where
 * today is the owner's. The diary records a day and no time, so "yesterday"
 * has to mean the owner's yesterday.
 */
export function daysSinceWatched(watchedOn: string, now: Date): number {
	return Math.max(0, dayNumber(ownerDay.format(now)) - dayNumber(watchedOn));
}

/** Whether a diary entry is inside its Spotlight eligibility window. */
export function isRecentlyWatched(
	entry: { watchedOn: string },
	now: Date,
): boolean {
	return daysSinceWatched(entry.watchedOn, now) <= RECENTLY_WATCHED_DAYS;
}
