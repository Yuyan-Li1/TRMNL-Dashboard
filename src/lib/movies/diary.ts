import { daysSinceDay } from "@/lib/owner-day";

/** A movie is eligible for the Spotlight for this many days from its watched date. */
export const SPOTLIGHT_ELIGIBLE_DAYS = 14;

/**
 * Whole calendar days from a diary entry's watched date to today, where
 * today is the owner's. The diary records a day and no time, so "yesterday"
 * has to mean the owner's yesterday.
 */
export function daysSinceWatched(watchedOn: string, now: Date): number {
	return daysSinceDay(watchedOn, now);
}

/** Whether a diary entry is inside its Spotlight eligibility window. */
export function isEligibleForSpotlight(
	entry: { watchedOn: string },
	now: Date,
): boolean {
	return daysSinceWatched(entry.watchedOn, now) <= SPOTLIGHT_ELIGIBLE_DAYS;
}
