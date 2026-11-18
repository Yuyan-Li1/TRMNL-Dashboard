import type { Check } from "@/lib/alerts/alerts";
import { addDays, daysUntilDay } from "@/lib/owner-day";
import { SOURCE_IDS, SOURCES, type SourceId } from "./sources";
import type { RefreshStatus } from "./status";

/** Who is speaking in Vercel's Alerts, and the start of its failures' ids. */
export const SENDER = "vercel";
/** A failed source read alerts after this many failed runs in a row: 1 hour. */
const FAILED_RUNS_BEFORE_ALERT = 4;
/** Sony's NPSSO lasts 60 days from the day it is issued. */
export const NPSSO_LIFETIME_DAYS = 60;
/** The day the Nintendo session token now configured stops working. */
const NINTENDO_TOKEN_EXPIRES_ON = "2028-11-16";
/** A dated token alerts this many days before it expires, nearest first. */
const ALERT_DAYS_BEFORE = [3, 14] as const;

const DAY_FORMAT = new Intl.DateTimeFormat("en-GB", {
	timeZone: "UTC",
	day: "numeric",
	month: "short",
	year: "numeric",
});

/** A day (`YYYY-MM-DD`) as "17 Jan 2027". */
export function formatDay(day: string): string {
	return DAY_FORMAT.format(new Date(`${day}T00:00:00Z`));
}

/**
 * The day (`YYYY-MM-DD`) a source's token expires, where it has a date.
 * Trakt's client id has none.
 */
export function tokenExpiry(
	id: SourceId,
	status: RefreshStatus | null,
): string | undefined {
	if (id === "psn") {
		return status?.npsso
			? addDays(status.npsso.changedOn, NPSSO_LIFETIME_DAYS)
			: undefined;
	}
	return id === "switch" ? NINTENDO_TOKEN_EXPIRES_ON : undefined;
}

function sourceCheck(id: SourceId, status: RefreshStatus): Check {
	const { name, token } = SOURCES[id];
	const health = status.sources[id];
	const check: Check = { id: `${SENDER}:${id}`, label: name, failure: null };
	if (!health || health.failuresInARow === 0) {
		return check;
	}

	if (health.rejected && token) {
		check.failure = { what: `${token.name} rejected`, fix: token.fix };
	} else if (health.failuresInARow >= FAILED_RUNS_BEFORE_ALERT) {
		check.failure = { what: `${name} read failing` };
	}
	if (check.failure && health.failingSince) {
		check.failure.since = health.failingSince;
	}
	return check;
}

function expiryCheck(
	checkId: string,
	id: SourceId,
	status: RefreshStatus,
	now: Date,
): Check {
	const token = SOURCES[id].token;
	const check: Check = {
		id: checkId,
		// The source's name, not the token's: the label of the last Alert is
		// shown on the public status strip
		label: SOURCES[id].name,
		failure: null,
		oneOff: true,
	};
	const expiresOn = tokenExpiry(id, status);
	if (!expiresOn) {
		return check;
	}
	const daysLeft = daysUntilDay(expiresOn, now);
	const within = ALERT_DAYS_BEFORE.find((days) => daysLeft <= days);
	if (within !== undefined) {
		check.failure = {
			what: `${token?.name ?? check.label} expires within ${within} days, on ${formatDay(expiresOn)}`,
		};
		if (token) {
			check.failure.fix = token.fix;
		}
	}
	return check;
}

/**
 * What Vercel alerts on, judged from the refresh's bookkeeping: a source or
 * Catalog read that keeps failing, a rejected token, and a dated token close
 * to expiry.
 */
export function healthChecks(status: RefreshStatus, now: Date): Check[] {
	return [
		...SOURCE_IDS.map((id) => sourceCheck(id, status)),
		expiryCheck(`${SENDER}:psn-expiry`, "psn", status, now),
		expiryCheck(`${SENDER}:nintendo-expiry`, "switch", status, now),
	];
}
