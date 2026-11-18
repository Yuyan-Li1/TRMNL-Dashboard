import { OWNER_TIME_ZONE } from "@/lib/config";
import { type HomeJobStatus, JOB_NAMES, type JobName } from "@/lib/home/status";
import { addDays, ownerDay } from "@/lib/owner-day";
import { HOUR_MS, MINUTE_MS } from "@/lib/time";
import type { Database } from "./db";

/** Something the Collector does on a schedule. No process lives between ticks. */
export interface Job {
	name: JobName;
	/** Whether the job should run on this tick, given when it was last tried */
	isDue(lastAttempt: Date | null, now: Date): boolean;
	run(now: Date): Promise<void>;
}

/**
 * Ticks are 15 minutes apart, give or take. Without some slack a job tried
 * at 00:00:03 would not be due at 06:00:01 and would wait for 06:15.
 */
const TICK_SLACK_MS = 5 * MINUTE_MS;

const OWNER_TIME_FORMAT = new Intl.DateTimeFormat("en-GB", {
	timeZone: OWNER_TIME_ZONE,
	hour: "2-digit",
	minute: "2-digit",
	hourCycle: "h23",
});

/** A moment as the owner's clock reads it: `2026-11-18T03:30`. */
function ownerStamp(at: Date): string {
	return `${ownerDay(at)}T${OWNER_TIME_FORMAT.format(at)}`;
}

/** Due when it was last tried this many hours ago, or never. */
export function everyHours(hours: number): Job["isDue"] {
	return (lastAttempt, now) =>
		!lastAttempt ||
		now.getTime() - lastAttempt.getTime() >= hours * HOUR_MS - TICK_SLACK_MS;
}

/**
 * Due once the owner's clock has passed a time of day (`03:30`) that the job
 * has not been tried since. A job never tried is due at once.
 */
export function dailyAt(time: string): Job["isDue"] {
	return (lastAttempt, now) => {
		if (!lastAttempt) {
			return true;
		}
		const stamp = ownerStamp(now);
		const today = stamp.slice(0, 10);
		const scheduled =
			stamp.slice(11) >= time
				? `${today}T${time}`
				: `${addDays(today, -1)}T${time}`;
		return ownerStamp(lastAttempt) < scheduled;
	};
}

interface JobRow {
	name: string;
	last_attempt_at: string | null;
	last_success_at: string | null;
	failures_in_a_row: number;
	failing_since: string | null;
	last_error: string | null;
}

/** Every job as the record has it. A job never tried has no failures. */
export function readJobs(db: Database): Record<JobName, HomeJobStatus> {
	const rows = db.prepare("SELECT * FROM jobs").all() as unknown as JobRow[];
	const jobs = Object.fromEntries(
		JOB_NAMES.map((name): [JobName, HomeJobStatus] => [
			name,
			{ failuresInARow: 0 },
		]),
	) as Record<JobName, HomeJobStatus>;
	for (const row of rows) {
		if (!(row.name in jobs)) {
			continue;
		}
		const job: HomeJobStatus = { failuresInARow: row.failures_in_a_row };
		if (row.last_attempt_at) job.lastAttemptAt = row.last_attempt_at;
		if (row.last_success_at) job.lastSuccessAt = row.last_success_at;
		if (row.failing_since) job.failingSince = row.failing_since;
		if (row.last_error) job.lastError = row.last_error;
		jobs[row.name as JobName] = job;
	}
	return jobs;
}

/**
 * Run one job and record how it went. Never throws: a failed job is counted
 * and the tick goes on.
 */
export async function runJob(db: Database, job: Job, now: Date): Promise<void> {
	const at = now.toISOString();
	db.prepare(
		`INSERT INTO jobs (name, last_attempt_at) VALUES (?, ?)
		 ON CONFLICT (name) DO UPDATE SET last_attempt_at = excluded.last_attempt_at`,
	).run(job.name, at);
	try {
		await job.run(now);
		db.prepare(
			`UPDATE jobs SET last_success_at = ?, failures_in_a_row = 0,
			 failing_since = NULL, last_error = NULL WHERE name = ?`,
		).run(at, job.name);
	} catch (error) {
		console.error(`Job ${job.name} failed:`, error);
		db.prepare(
			`UPDATE jobs SET failures_in_a_row = failures_in_a_row + 1,
			 failing_since = COALESCE(failing_since, ?), last_error = ? WHERE name = ?`,
		).run(at, String(error), job.name);
	}
}

/** Run whichever jobs are due according to the record, one after another. */
export async function runDueJobs(
	db: Database,
	jobs: Job[],
	now: Date,
): Promise<void> {
	const record = readJobs(db);
	for (const job of jobs) {
		const last = record[job.name].lastAttemptAt;
		if (job.isDue(last ? new Date(last) : null, now)) {
			await runJob(db, job, now);
		}
	}
}
