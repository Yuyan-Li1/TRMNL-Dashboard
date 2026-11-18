import type { Check } from "@/lib/alerts/alerts";
import type { HomeStatus } from "@/lib/home/status";
import { addDays, daysUntilDay } from "@/lib/owner-day";
import { HOUR_MS } from "@/lib/time";
import type { DailyStatus } from "./daily";
import { isHeartbeatStale } from "./home";
import { SOURCE_IDS, SOURCES, type SourceId } from "./sources";
import type { RefreshStatus } from "./status";

/** Who is speaking in Vercel's Alerts, and the start of its failures' ids. */
export const SENDER = "vercel";
/** A failed source read alerts after this many failed runs in a row: 1 hour. */
const FAILED_RUNS_BEFORE_ALERT = 4;
/**
 * The daily run alerts once its last clean run is this old: two runs missed
 * or failed, with room for GitHub's schedule running late.
 */
const DAILY_STALE_AFTER_MS = 50 * HOUR_MS;
/** Sony's NPSSO lasts 60 days from the day it is issued. */
export const NPSSO_LIFETIME_DAYS = 60;
/** The day the Nintendo session token now configured stops working. */
const NINTENDO_TOKEN_EXPIRES_ON = "2028-11-16";
/** A dated token alerts this many days before it expires, nearest first. */
export const ALERT_DAYS_BEFORE = [3, 14] as const;

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

/**
 * What to say of a dated token close to expiry, "PSN NPSSO expires within 14
 * days, on 17 Jan 2027", or null while it is further off. Shared with the
 * Collector, which dates the Claude Code token.
 */
export function expiryAlert(
	tokenName: string,
	expiresOn: string,
	now: Date,
): string | null {
	const daysLeft = daysUntilDay(expiresOn, now);
	const within = ALERT_DAYS_BEFORE.find((days) => daysLeft <= days);
	return within === undefined
		? null
		: `${tokenName} expires within ${within} days, on ${formatDay(expiresOn)}`;
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
	const what =
		expiresOn && expiryAlert(token?.name ?? check.label, expiresOn, now);
	if (what) {
		check.failure = { what };
		if (token) {
			check.failure.fix = token.fix;
		}
	}
	return check;
}

/**
 * The home server's heartbeat, which only Vercel can watch. Before the
 * Collector has ever ticked there is nothing to be Stale.
 */
function heartbeatCheck(home: HomeStatus | null, now: Date): Check {
	return {
		id: `${SENDER}:home-heartbeat`,
		label: "Home server",
		failure:
			home && isHeartbeatStale(home, now)
				? { what: "Home server heartbeat Stale", since: home.heartbeatAt }
				: null,
	};
}

/**
 * The daily run, which nothing else watches: it has stopped running, or
 * every run has an error. Before it has ever run there is nothing to be
 * Stale.
 */
function dailyCheck(daily: DailyStatus | null, now: Date): Check {
	const check: Check = {
		id: `${SENDER}:daily`,
		label: "Daily run",
		failure: null,
	};
	const lastGood = daily?.lastSuccessAt ?? daily?.failingSince;
	if (
		!daily ||
		!lastGood ||
		now.getTime() - new Date(lastGood).getTime() <= DAILY_STALE_AFTER_MS
	) {
		return check;
	}
	check.failure =
		daily.errors.length > 0
			? { what: "Daily run failing", since: daily.failingSince ?? lastGood }
			: { what: "Daily run Stale", since: lastGood };
	return check;
}

/**
 * What Vercel alerts on, judged from the refresh's bookkeeping, the
 * Collector's status and the daily run's bookkeeping: a source or Catalog
 * read that keeps failing, a rejected token, a dated token close to expiry,
 * a home server that has stopped ticking, and a daily run that has stopped
 * or keeps failing.
 */
export function healthChecks(
	status: RefreshStatus,
	now: Date,
	home: HomeStatus | null = null,
	daily: DailyStatus | null = null,
): Check[] {
	return [
		...SOURCE_IDS.map((id) => sourceCheck(id, status)),
		expiryCheck(`${SENDER}:psn-expiry`, "psn", status, now),
		expiryCheck(`${SENDER}:nintendo-expiry`, "switch", status, now),
		heartbeatCheck(home, now),
		dailyCheck(daily, now),
	];
}
