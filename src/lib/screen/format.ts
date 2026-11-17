import { DAY_MS, HOUR_MS, MINUTE_MS } from "@/lib/time";

function plural(count: number, unit: string): string {
	return `${count} ${unit}${count === 1 ? "" : "s"}`;
}

/** When something happened, relative to now: "3 hours ago", "yesterday". */
export function formatWhen(at: string, now: Date): string {
	const elapsed = Math.max(0, now.getTime() - new Date(at).getTime());
	if (elapsed < MINUTE_MS) return "just now";
	if (elapsed < HOUR_MS) {
		return `${plural(Math.floor(elapsed / MINUTE_MS), "minute")} ago`;
	}
	if (elapsed < DAY_MS) {
		return `${plural(Math.floor(elapsed / HOUR_MS), "hour")} ago`;
	}
	const days = Math.floor(elapsed / DAY_MS);
	if (days === 1) return "yesterday";
	if (days < 14) return `${days} days ago`;
	if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
	if (days < 365) return `${Math.floor(days / 30)} months ago`;
	return `${plural(Math.floor(days / 365), "year")} ago`;
}

/** Play time as whole hours, or minutes under an hour. */
export function formatHours(minutes: number): string {
	if (minutes < 60) {
		return plural(minutes, "minute");
	}
	return plural(Math.round(minutes / 60), "hour");
}
