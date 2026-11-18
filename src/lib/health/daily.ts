import { getRedis } from "@/lib/cache/redis";

/** The daily run's bookkeeping. It has no TTL. */
export const DAILY_STATUS_KEY = "daily:status";

/** What is remembered of the daily run between runs. */
export interface DailyStatus {
	lastRunAt: string;
	/** The last run with no error */
	lastSuccessAt?: string;
	/** The first of the runs in a row that had an error */
	failingSince?: string;
	/** What the last run could not do, one line each */
	errors: string[];
}

/** The bookkeeping after a run that ended with these errors. */
export function nextDailyStatus(
	previous: DailyStatus | null,
	errors: string[],
	now: Date,
): DailyStatus {
	const at = now.toISOString();
	if (errors.length === 0) {
		return { lastRunAt: at, lastSuccessAt: at, errors };
	}
	const status: DailyStatus = {
		lastRunAt: at,
		failingSince: previous?.failingSince ?? at,
		errors,
	};
	if (previous?.lastSuccessAt) {
		status.lastSuccessAt = previous.lastSuccessAt;
	}
	return status;
}

/** Null until the daily run has run once. */
export async function readDailyStatus(): Promise<DailyStatus | null> {
	return getRedis().get<DailyStatus>(DAILY_STATUS_KEY);
}

/** Note how a daily run ended. */
export async function recordDailyRun(
	errors: string[],
	now: Date,
): Promise<void> {
	const redis = getRedis();
	const previous = await redis.get<DailyStatus>(DAILY_STATUS_KEY);
	await redis.set(DAILY_STATUS_KEY, nextDailyStatus(previous, errors, now));
}
