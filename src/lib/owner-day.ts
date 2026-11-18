import { OWNER_TIME_ZONE } from "@/lib/config";
import { DAY_MS } from "@/lib/time";

const OWNER_DAY_FORMAT = new Intl.DateTimeFormat("en-CA", {
	timeZone: OWNER_TIME_ZONE,
	year: "numeric",
	month: "2-digit",
	day: "2-digit",
});

function dayNumber(day: string): number {
	return Math.round(new Date(`${day}T00:00:00Z`).getTime() / DAY_MS);
}

/** The owner's calendar day at a moment, `YYYY-MM-DD`. */
export function ownerDay(at: Date): string {
	return OWNER_DAY_FORMAT.format(at);
}

/**
 * Whole calendar days from a day (`YYYY-MM-DD`) to today, where today is the
 * owner's. For activity known to the day and not the hour, so "yesterday"
 * means the owner's yesterday.
 */
export function daysSinceDay(day: string, now: Date): number {
	return Math.max(0, dayNumber(ownerDay(now)) - dayNumber(day));
}
