import { daysUntilDay } from "@/lib/owner-day";
import { ALERT_DAYS_BEFORE, formatDay, tokenExpiry } from "./checks";
import { SOURCE_IDS, SOURCES, type SourceId } from "./sources";
import { isStale, type RefreshStatus } from "./status";
import { formatWhenOrNever } from "./strip";

/** One source or Catalog as the admin area shows it. */
export interface HealthRow {
	id: SourceId;
	name: string;
	catalog: boolean;
	/** In words: "Reading", "Stale", "Failing since 18 Nov 11:15" */
	state: string;
	/** Whether the owner has something to look at */
	trouble: boolean;
	lastGoodRead: string;
	failedRuns: number;
	/** The last error, while the source is failing */
	detail?: string;
	/** What to do about it, where there is a known fix */
	fix?: string;
	token?: string;
	/** "31 Dec 2026, in 43 days", "No expiry", "Not known yet" */
	expires?: string;
	expiresSoon: boolean;
}

/** The refresh's bookkeeping, read for the owner. Not public. */
export interface HealthReport {
	/** One sentence that answers "is anything wrong?" */
	headline: string;
	trouble: boolean;
	lastRefresh: string;
	rows: HealthRow[];
}

function sentence(text: string): string {
	return text.charAt(0).toUpperCase() + text.slice(1);
}

function inDays(days: number): string {
	if (days < 0) return "expired";
	if (days === 0) return "today";
	return days === 1 ? "in 1 day" : `in ${days} days`;
}

function healthRow(
	id: SourceId,
	status: RefreshStatus | null,
	now: Date,
): HealthRow {
	const { name, kind, token } = SOURCES[id];
	const health = status?.sources[id];
	const failedRuns = health?.failuresInARow ?? 0;
	const row: HealthRow = {
		id,
		name,
		catalog: kind === "catalog",
		state: health?.lastGoodReadAt ? "Reading" : "Not read yet",
		trouble: false,
		lastGoodRead: formatWhenOrNever(health?.lastGoodReadAt),
		failedRuns,
		expiresSoon: false,
	};

	if (failedRuns > 0) {
		row.trouble = true;
		if (health?.rejected && token) {
			row.state = `${token.name} rejected`;
			row.fix = sentence(token.fix);
		} else {
			row.state = `Failing since ${formatWhenOrNever(health?.failingSince)}`;
		}
		if (health?.lastError) {
			row.detail = health.lastError;
		}
	} else if (isStale(id, health, now)) {
		row.trouble = true;
		row.state = health?.lastGoodReadAt ? "Stale" : "Never read";
	}

	if (token) {
		row.token = token.name;
		const expiresOn = tokenExpiry(id, status);
		if (expiresOn) {
			const daysLeft = daysUntilDay(expiresOn, now);
			row.expires = `${formatDay(expiresOn)}, ${inDays(daysLeft)}`;
			if (daysLeft <= Math.max(...ALERT_DAYS_BEFORE)) {
				row.expiresSoon = true;
				row.trouble = true;
				row.fix ??= sentence(token.fix);
			}
		} else {
			row.expires = id === "psn" ? "Not known yet" : "No expiry";
		}
	}

	return row;
}

function headline(status: RefreshStatus | null, rows: HealthRow[]): string {
	if (!status) {
		return "No refresh has run yet.";
	}
	const troubled = rows.filter((row) => row.trouble);
	if (troubled.length === 0) {
		return "Everything is reading.";
	}
	return troubled.length === 1
		? `${troubled[0]?.name} needs attention.`
		: `${troubled.length} sources need attention.`;
}

/** What the admin area says about the sources, their tokens and the refresh. */
export function healthReport(
	status: RefreshStatus | null,
	now: Date,
): HealthReport {
	const rows = SOURCE_IDS.map((id) => healthRow(id, status, now));
	return {
		headline: headline(status, rows),
		trouble: !status || rows.some((row) => row.trouble),
		lastRefresh: formatWhenOrNever(status?.lastSuccessAt),
		rows,
	};
}
