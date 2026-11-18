import { createHash } from "node:crypto";
import { getRedis } from "@/lib/cache/redis";
import { ownerDay } from "@/lib/owner-day";
import { HOUR_MS } from "@/lib/time";
import { SOURCE_IDS, SOURCES, type SourceId } from "./sources";

/** What one refresh run saw of one source. */
export interface SourceReads {
	good: number;
	failed: number;
	/** The source turned its token away */
	rejected?: boolean;
	/** The last failure, for the source health page */
	error?: string;
}

/** The sources a run read. One it did not need to read is absent. */
export type RunReads = Partial<Record<SourceId, SourceReads>>;

export interface SourceHealth {
	lastGoodReadAt?: string;
	/**
	 * Runs in a row in which no read of the source worked; a run that did not
	 * read it is not counted
	 */
	failuresInARow: number;
	/** When the first of those runs failed */
	failingSince?: string;
	rejected?: boolean;
	lastError?: string;
}

/** The PSN token as last seen, to date its expiry without a hand-set date. */
export interface NpssoRecord {
	fingerprint: string;
	/** The owner's day (`YYYY-MM-DD`) the fingerprint changed */
	changedOn: string;
}

/** The refresh's bookkeeping, kept in Redis under `REFRESH_STATUS_KEY`. */
export interface RefreshStatus {
	/** When a refresh last ran through and stored its data */
	lastSuccessAt: string;
	sources: Partial<Record<SourceId, SourceHealth>>;
	npsso?: NpssoRecord;
}

export interface RunResult {
	reads: RunReads;
	/**
	 * The PSN token now configured. `knownSince` is the day it was set, where
	 * that is known from before fingerprints were kept.
	 */
	npsso?: { fingerprint: string; knownSince?: string };
}

export const REFRESH_STATUS_KEY = "refresh:status";

/**
 * How old a Source's last good read may be. Sources are read hourly; the
 * second hour allows for GitHub's schedule running late.
 */
const STALE_AFTER_MS = 2 * HOUR_MS;

function updateSource(
	previous: SourceHealth | undefined,
	reads: SourceReads | undefined,
	at: string,
): SourceHealth | undefined {
	if (!reads || (reads.good === 0 && reads.failed === 0)) {
		return previous;
	}
	// One read that worked makes the run good: a single show or Title the
	// source cannot answer for is not the source failing
	if (reads.good > 0) {
		return { lastGoodReadAt: at, failuresInARow: 0 };
	}
	const health: SourceHealth = {
		failuresInARow: (previous?.failuresInARow ?? 0) + 1,
		failingSince: previous?.failingSince ?? at,
	};
	if (previous?.lastGoodReadAt) {
		health.lastGoodReadAt = previous.lastGoodReadAt;
	}
	// Once rejected, a token stays so until the source is read again
	if (reads.rejected || previous?.rejected) {
		health.rejected = true;
	}
	if (reads.error) {
		health.lastError = reads.error;
	}
	return health;
}

/** The bookkeeping after a refresh that ran through. */
export function updateStatus(
	previous: RefreshStatus | null,
	run: RunResult,
	now: Date,
): RefreshStatus {
	const at = now.toISOString();
	const status: RefreshStatus = { lastSuccessAt: at, sources: {} };

	for (const id of SOURCE_IDS) {
		const health = updateSource(previous?.sources[id], run.reads[id], at);
		if (health) {
			status.sources[id] = health;
		}
	}

	if (run.npsso && run.npsso.fingerprint === previous?.npsso?.fingerprint) {
		status.npsso = previous.npsso;
	} else if (run.npsso) {
		status.npsso = {
			fingerprint: run.npsso.fingerprint,
			changedOn: run.npsso.knownSince ?? ownerDay(now),
		};
	}

	return status;
}

/**
 * Whether a source is Stale: its last good read is older than expected. A
 * Catalog is read only when a Title needs looking up, so it is Stale only
 * while its reads are failing.
 */
export function isStale(
	id: SourceId,
	health: SourceHealth | undefined,
	now: Date,
): boolean {
	if (SOURCES[id].kind === "catalog" && !health?.failuresInARow) {
		return false;
	}
	if (!health?.lastGoodReadAt) {
		return true;
	}
	return (
		now.getTime() - new Date(health.lastGoodReadAt).getTime() > STALE_AFTER_MS
	);
}

/** A short one-way mark of a token: enough to see that it has changed. */
export function fingerprint(token: string): string {
	return createHash("sha256").update(token).digest("hex").slice(0, 16);
}

export async function readRefreshStatus(): Promise<RefreshStatus | null> {
	return getRedis().get<RefreshStatus>(REFRESH_STATUS_KEY);
}

export async function writeRefreshStatus(status: RefreshStatus): Promise<void> {
	await getRedis().set(REFRESH_STATUS_KEY, status);
}
