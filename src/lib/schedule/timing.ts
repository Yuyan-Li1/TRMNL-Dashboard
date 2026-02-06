import { addMinutes } from "date-fns";
import { LOCATION, TRMNL } from "@/lib/config";
import { applyBuffer, getNow, parseTimeToday } from "@/lib/utils/date";
import type { ScheduleConfig } from "@/types/schedule";

// Default TRMNL refresh configuration
const DEFAULT_CONFIG: ScheduleConfig = {
	refreshIntervalMinutes: TRMNL.refreshIntervalMinutes,
	bufferMinutes: TRMNL.bufferMinutes,
	timezone: LOCATION.timezone,
};

/**
 * Calculate when the next content transition should occur
 */
export function getNextTransitionTime(
	currentBlockEnd: string,
	config: ScheduleConfig = DEFAULT_CONFIG,
): { transitionAt: Date; displayFrom: Date } {
	const now = getNow(config.timezone);
	const transitionAt = parseTimeToday(currentBlockEnd, config.timezone);

	// If transition is in the past, it's tomorrow
	if (transitionAt <= now) {
		transitionAt.setDate(transitionAt.getDate() + 1);
	}

	// Calculate when to start showing next content (with buffer)
	const displayFrom = addMinutes(transitionAt, -config.bufferMinutes);

	return { transitionAt, displayFrom };
}

/**
 * Calculate the optimal refresh schedule
 * Returns times when TRMNL should refresh to catch content changes
 */
export function getOptimalRefreshTimes(
	blockTransitions: string[], // Array of HH:mm times
	config: ScheduleConfig = DEFAULT_CONFIG,
): string[] {
	const refreshTimes: Set<string> = new Set();

	for (const transition of blockTransitions) {
		// Add refresh time with buffer before transition
		const bufferedTime = applyBuffer(transition, config.bufferMinutes);
		refreshTimes.add(bufferedTime);

		// Add one more refresh shortly after transition
		const afterTransition = addMinutes(
			parseTimeToday(transition, config.timezone),
			5,
		);
		refreshTimes.add(
			`${String(afterTransition.getHours()).padStart(2, "0")}:${String(afterTransition.getMinutes()).padStart(2, "0")}`,
		);
	}

	return Array.from(refreshTimes).sort();
}

/**
 * Check if we're in a transition buffer period
 * (Should show upcoming content instead of current)
 */
export function isInTransitionBuffer(
	nextBlockStart: string,
	config: ScheduleConfig = DEFAULT_CONFIG,
): boolean {
	const now = getNow(config.timezone);
	const transitionTime = parseTimeToday(nextBlockStart, config.timezone);
	const bufferStart = addMinutes(transitionTime, -config.bufferMinutes);

	return now >= bufferStart && now < transitionTime;
}

/**
 * Get minutes until next refresh would be useful
 */
export function getMinutesUntilNextUsefulRefresh(
	blockTransitions: string[],
	config: ScheduleConfig = DEFAULT_CONFIG,
): number {
	const now = getNow(config.timezone);
	const currentMinutes = now.getHours() * 60 + now.getMinutes();

	let minMinutes = config.refreshIntervalMinutes; // Default to next scheduled refresh

	for (const transition of blockTransitions) {
		const [h, m] = transition.split(":").map(Number);
		let transitionMinutes = h * 60 + m;

		// Apply buffer
		transitionMinutes -= config.bufferMinutes;
		if (transitionMinutes < 0) transitionMinutes += 24 * 60;

		// Calculate minutes until this transition buffer
		let diff = transitionMinutes - currentMinutes;
		if (diff < 0) diff += 24 * 60; // Tomorrow

		if (diff > 0 && diff < minMinutes) {
			minMinutes = diff;
		}
	}

	return minMinutes;
}

/**
 * Format remaining time for display
 */
export function formatTimeUntil(minutes: number): string {
	if (minutes < 60) {
		return `${minutes}m`;
	}

	const hours = Math.floor(minutes / 60);
	const mins = minutes % 60;

	if (mins === 0) {
		return `${hours}h`;
	}

	return `${hours}h ${mins}m`;
}
