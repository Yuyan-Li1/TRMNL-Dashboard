/**
 * What the Collector publishes about itself, shared by both sides. The
 * Collector writes it on every tick; Vercel only reads it. This file imports
 * nothing, so either side can load it.
 */

/** Every key the Collector writes starts with `home:`. */
export const HOME_KEYS = {
	STATUS: "home:status",
	BOOKS: "home:books",
	BACKUP: "home:backup",
} as const;
// The consumed sets, `home:consumed:<medium>`, are in `@/lib/consumed/set`

export const JOB_NAMES = [
	"goodreads",
	"consumed",
	"code-update",
	"snapshot",
] as const;
export type JobName = (typeof JOB_NAMES)[number];

export const JOB_LABELS: Record<JobName, string> = {
	goodreads: "Goodreads read",
	consumed: "Consumed set",
	"code-update": "Code update",
	snapshot: "Snapshot",
};

/** One of the Collector's jobs, as its record has it. */
export interface HomeJobStatus {
	lastAttemptAt?: string;
	lastSuccessAt?: string;
	failuresInARow: number;
	/** When the first of those failures happened */
	failingSince?: string;
	/** The last failure, for the source health page */
	lastError?: string;
}

/** The value of `home:status`, rewritten every tick. */
export interface HomeStatus {
	/** When the Collector last ticked */
	heartbeatAt: string;
	/** The commit the Collector is running */
	commit: string;
	/** The day (`YYYY-MM-DD`) the Claude Code token expires, once one is set */
	claudeTokenExpiresOn?: string;
	jobs: Record<JobName, HomeJobStatus>;
}
