import { format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { LOCATION } from "@/lib/config";

const DEFAULT_TIMEZONE = LOCATION.timezone;

/**
 * Get current time in configured timezone
 */
export function getNow(timezone: string = DEFAULT_TIMEZONE): Date {
	return toZonedTime(new Date(), timezone);
}

/**
 * Format time as HH:mm
 */
export function formatTime(date: Date): string {
	return format(date, "HH:mm");
}

/**
 * Format date as YYYY-MM-DD
 */
export function formatDate(date: Date): string {
	return format(date, "yyyy-MM-dd");
}

/**
 * Parse HH:mm time string to today's date
 */
export function parseTimeToday(
	timeStr: string,
	timezone: string = DEFAULT_TIMEZONE,
): Date {
	const now = getNow(timezone);
	const [hours, minutes] = timeStr.split(":").map(Number);

	const result = new Date(now);
	result.setHours(hours, minutes, 0, 0);

	return result;
}

/**
 * Check if a given time is within a time range
 * Handles overnight ranges (e.g., 22:00 - 06:00)
 */
export function isWithinTimeRange(
	current: Date,
	startTime: string,
	endTime: string,
	_timezone?: string,
): boolean {
	const currentMinutes = current.getHours() * 60 + current.getMinutes();

	const [startH, startM] = startTime.split(":").map(Number);
	const [endH, endM] = endTime.split(":").map(Number);

	const startMinutes = startH * 60 + startM;
	const endMinutes = endH * 60 + endM;

	// Handle overnight range (e.g., 22:00 - 06:00)
	if (startMinutes > endMinutes) {
		return currentMinutes >= startMinutes || currentMinutes < endMinutes;
	}

	return currentMinutes >= startMinutes && currentMinutes < endMinutes;
}

/**
 * Apply buffer to a time (subtract minutes)
 */
export function applyBuffer(timeStr: string, bufferMinutes: number): string {
	const [hours, minutes] = timeStr.split(":").map(Number);
	let totalMinutes = hours * 60 + minutes - bufferMinutes;

	// Handle negative (wrap to previous day)
	if (totalMinutes < 0) {
		totalMinutes += 24 * 60;
	}

	const newHours = Math.floor(totalMinutes / 60) % 24;
	const newMinutes = totalMinutes % 60;

	return `${String(newHours).padStart(2, "0")}:${String(newMinutes).padStart(2, "0")}`;
}

/**
 * Get day of week (0 = Sunday, 6 = Saturday)
 */
export function getDayOfWeek(timezone: string = DEFAULT_TIMEZONE): number {
	return getNow(timezone).getDay();
}

/**
 * Check if a date is a weekend
 */
export function isWeekend(date: Date = getNow()): boolean {
	const day = date.getDay();
	return day === 0 || day === 6;
}
