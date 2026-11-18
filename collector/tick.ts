import {
	processChecks,
	type SendResult,
	type SentAlert,
} from "@/lib/alerts/alerts";
import { OWNER_TIME_ZONE } from "@/lib/config";
import { REFRESH_STATUS_KEY, type RefreshStatus } from "@/lib/health/status";
import { HOME_KEYS, type HomeStatus } from "@/lib/home/status";
import { HOUR_MS, MINUTE_MS } from "@/lib/time";
import { alertStore } from "./alert-store";
import { homeChecks, SENDER, type TickFindings } from "./checks";
import { unmatchedLines } from "./consumed/sets";
import type { Database } from "./db";
import { type Job, readJobs, runDueJobs } from "./jobs";
import type { HomeRedis } from "./redis";
import { claudeTokenExpiry } from "./token";

/** The tick calls the refresh itself once the last success is this old. */
const REFRESH_OURSELVES_AFTER_MS = 30 * MINUTE_MS;
/** The Vercel refresh is Stale, and alerts, once its last success is this old. */
const REFRESH_STALE_AFTER_MS = HOUR_MS;

export interface TickOptions {
	db: Database;
	redis: HomeRedis;
	jobs: Job[];
	now: Date;
	/** The commit the Collector is running */
	commit: string;
	/** `CLAUDE_CODE_OAUTH_TOKEN`, where one is set */
	claudeToken?: string;
	/** Call `POST /api/refresh`; rejects when the refresh did not run through */
	refresh(): Promise<void>;
	/** Send one message to the owner */
	send(text: string): Promise<SendResult>;
	/**
	 * Rewrite what the Collector publishes besides its status. Runs after the
	 * jobs, while Redis can be reached.
	 */
	publish?(): Promise<void>;
}

/** The value of `home:status`, built from the record. */
export function homeStatus(
	db: Database,
	{
		now,
		commit,
		claudeToken,
	}: Pick<TickOptions, "now" | "commit" | "claudeToken">,
): HomeStatus {
	const status: HomeStatus = {
		heartbeatAt: now.toISOString(),
		commit,
		jobs: readJobs(db),
	};
	const expiresOn = claudeTokenExpiry(db, claudeToken, now);
	if (expiresOn) {
		status.claudeTokenExpiresOn = expiresOn;
	}
	return status;
}

/**
 * Whether the Vercel refresh is Stale. GitHub's schedule is often late, so
 * when the last success is more than 30 minutes old the tick calls the
 * refresh itself, and a refresh that then runs through is not Stale.
 */
async function checkRefresh({
	redis,
	refresh,
	now,
}: TickOptions): Promise<TickFindings["refresh"]> {
	const status = await redis.get<RefreshStatus>(REFRESH_STATUS_KEY);
	const lastSuccessAt = status?.lastSuccessAt;
	const age = lastSuccessAt
		? now.getTime() - new Date(lastSuccessAt).getTime()
		: Number.POSITIVE_INFINITY;
	if (age <= REFRESH_OURSELVES_AFTER_MS) {
		return { stale: false };
	}
	try {
		await refresh();
		return { stale: false };
	} catch (error) {
		console.error("Refresh called from the tick failed:", error);
	}
	return { stale: age > REFRESH_STALE_AFTER_MS, lastSuccessAt };
}

/**
 * One tick, started by launchd every 15 minutes: write the heartbeat, check
 * the Vercel refresh, run the jobs that are due and send the Alerts all of
 * that calls for. No process stays alive between ticks, so everything a
 * tick needs to remember is in SQLite.
 */
export async function runTick(options: TickOptions): Promise<SentAlert[]> {
	const { db, redis, jobs, now } = options;
	const findings: TickFindings = { redisReachable: true, jobs: readJobs(db) };

	// The heartbeat goes first, so a job that hangs cannot hold it back
	try {
		await redis.set(HOME_KEYS.STATUS, homeStatus(db, options));
		findings.refresh = await checkRefresh(options);
	} catch (error) {
		console.error("Redis could not be reached:", error);
		findings.redisReachable = false;
	}

	await runDueJobs(db, jobs, now);

	const status = homeStatus(db, options);
	findings.jobs = status.jobs;
	findings.claudeTokenExpiresOn = status.claudeTokenExpiresOn;
	findings.unmatchedLines = unmatchedLines(db);
	if (findings.redisReachable) {
		try {
			await redis.set(HOME_KEYS.STATUS, status);
			await options.publish?.();
		} catch (error) {
			console.error("Publishing to Redis failed:", error);
		}
	}

	return processChecks({
		sender: SENDER,
		checks: homeChecks(findings, now),
		store: alertStore(db, redis),
		send: options.send,
		now,
		timeZone: OWNER_TIME_ZONE,
	});
}
