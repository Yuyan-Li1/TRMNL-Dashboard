import {
	type HomeStatus,
	JOB_LABELS,
	JOB_NAMES,
	type JobName,
} from "@/lib/home/status";
import { daysUntilDay } from "@/lib/owner-day";
import { ALERT_DAYS_BEFORE, formatDay, tokenExpiry } from "./checks";
import { isHeartbeatStale } from "./home";
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

/** One of the Collector's jobs as the admin area shows it. */
export interface HomeJobRow {
	id: JobName;
	name: string;
	/** In words: "Running", "Not run yet", "Failing since 18 Nov 11:15" */
	state: string;
	trouble: boolean;
	lastAttempt: string;
	lastSuccess: string;
	failedRuns: number;
	/** The last error, while the job is failing */
	detail?: string;
}

/** The home server as the admin area shows it. */
export interface HomeReport {
	heartbeat: string;
	/** The heartbeat is more than an hour old */
	stale: boolean;
	commit: string;
	/** "18 Nov 2027, in 365 days", once a Claude Code token is set */
	claudeTokenExpires?: string;
	claudeTokenExpiresSoon: boolean;
	jobs: HomeJobRow[];
	/** What needs the owner's attention, by name */
	troubled: string[];
}

/**
 * The refresh's bookkeeping and the Collector's status, read for the owner.
 * Not public.
 */
export interface HealthReport {
	/** One sentence that answers "is anything wrong?" */
	headline: string;
	trouble: boolean;
	lastRefresh: string;
	rows: HealthRow[];
	/** Null until the Collector has ticked once */
	home: HomeReport | null;
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

function homeReport(home: HomeStatus, now: Date): HomeReport {
	const report: HomeReport = {
		heartbeat: formatWhenOrNever(home.heartbeatAt),
		stale: isHeartbeatStale(home, now),
		commit: home.commit,
		claudeTokenExpiresSoon: false,
		jobs: JOB_NAMES.map((id) => {
			const job = home.jobs[id] ?? { failuresInARow: 0 };
			const row: HomeJobRow = {
				id,
				name: JOB_LABELS[id],
				state: job.lastSuccessAt ? "Running" : "Not run yet",
				trouble: job.failuresInARow > 0,
				lastAttempt: formatWhenOrNever(job.lastAttemptAt),
				lastSuccess: formatWhenOrNever(job.lastSuccessAt),
				failedRuns: job.failuresInARow,
			};
			if (row.trouble) {
				row.state = `Failing since ${formatWhenOrNever(job.failingSince)}`;
				if (job.lastError) {
					row.detail = job.lastError;
				}
			}
			return row;
		}),
		troubled: [],
	};
	if (home.claudeTokenExpiresOn) {
		const daysLeft = daysUntilDay(home.claudeTokenExpiresOn, now);
		report.claudeTokenExpires = `${formatDay(home.claudeTokenExpiresOn)}, ${inDays(daysLeft)}`;
		report.claudeTokenExpiresSoon = daysLeft <= Math.max(...ALERT_DAYS_BEFORE);
	}
	report.troubled = [
		...(report.stale ? ["Home server"] : []),
		...report.jobs.filter((job) => job.trouble).map((job) => job.name),
		...(report.claudeTokenExpiresSoon ? ["Claude Code token"] : []),
	];
	return report;
}

function headline(
	status: RefreshStatus | null,
	rows: HealthRow[],
	home: HomeReport | null,
): string {
	if (!status) {
		return "No refresh has run yet.";
	}
	const sources = rows.filter((row) => row.trouble).map((row) => row.name);
	const troubled = [...sources, ...(home?.troubled ?? [])];
	if (troubled.length === 0) {
		return "Everything is reading.";
	}
	if (troubled.length === 1) {
		return `${troubled[0]} needs attention.`;
	}
	return `${troubled.length} ${troubled.length === sources.length ? "sources" : "things"} need attention.`;
}

/**
 * What the admin area says about the sources, their tokens, the refresh and
 * the home server.
 */
export function healthReport(
	status: RefreshStatus | null,
	now: Date,
	homeStatus: HomeStatus | null = null,
): HealthReport {
	const rows = SOURCE_IDS.map((id) => healthRow(id, status, now));
	const home = homeStatus ? homeReport(homeStatus, now) : null;
	return {
		headline: headline(status, rows, home),
		trouble:
			!status ||
			rows.some((row) => row.trouble) ||
			(home !== null && home.troubled.length > 0),
		lastRefresh: formatWhenOrNever(status?.lastSuccessAt),
		rows,
		home,
	};
}
