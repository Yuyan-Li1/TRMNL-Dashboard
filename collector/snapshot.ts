import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	renameSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import path from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { HOME_KEYS } from "@/lib/home/status";
import type { Database } from "./db";
import { dailyAt, type Job } from "./jobs";
import type { HomeRedis } from "./redis";

/** How many nightly snapshots stay on the home server's disk. */
const SNAPSHOTS_KEPT = 14;

/** The newest snapshot as `home:backup` holds it. */
interface Backup {
	takenAt: string;
	/** The database file, gzipped, in base64 */
	database: string;
}

/** Snapshot files in a folder, oldest first: their names sort by time. */
function snapshotFiles(dir: string): string[] {
	if (!existsSync(dir)) {
		return [];
	}
	return readdirSync(dir)
		.filter((name) => /^collector-.*\.db$/.test(name))
		.sort()
		.map((name) => path.join(dir, name));
}

/**
 * Take a consistent copy of the record into the snapshots folder and drop
 * all but the last 14. Returns the new file.
 */
export function takeSnapshot(db: Database, dir: string, now: Date): string {
	mkdirSync(dir, { recursive: true });
	const stamp = now.toISOString().replace(/[:.]/g, "-");
	const file = path.join(dir, `collector-${stamp}.db`);
	rmSync(file, { force: true });
	// VACUUM INTO writes a whole, consistent database even mid-write
	db.prepare("VACUUM INTO ?").run(file);
	for (const old of snapshotFiles(dir).slice(0, -SNAPSHOTS_KEPT)) {
		rmSync(old);
	}
	return file;
}

/** Store the newest snapshot on disk, compressed, in `home:backup`. */
export async function publishBackup(
	dir: string,
	redis: HomeRedis,
): Promise<void> {
	const newest = snapshotFiles(dir).at(-1);
	if (!newest) {
		return;
	}
	const stamp = path.basename(newest, ".db").slice("collector-".length);
	const backup: Backup = {
		// `2026-11-18T01-00-00-000Z` back to an ISO time
		takenAt: stamp.replace(/T(\d+)-(\d+)-(\d+)-(\d+)Z$/, "T$1:$2:$3.$4Z"),
		database: gzipSync(readFileSync(newest)).toString("base64"),
	};
	await redis.set(HOME_KEYS.BACKUP, backup);
}

/** The nightly snapshot: a copy on disk and the newest in Redis. */
export function snapshotJob(options: {
	db: Database;
	dir: string;
	redis: HomeRedis;
}): Job {
	return {
		name: "snapshot",
		isDue: dailyAt("03:00"),
		run: async (now) => {
			takeSnapshot(options.db, options.dir, now);
			await publishBackup(options.dir, options.redis);
		},
	};
}

/**
 * Rebuild the record from the snapshot in Redis, or from the newest on disk
 * when Redis has none or cannot be reached. The record being replaced is
 * kept beside it as `.before-restore`. Returns where the snapshot came from.
 */
export async function restore(options: {
	databasePath: string;
	dir: string;
	redis: HomeRedis;
}): Promise<string> {
	const { databasePath, dir, redis } = options;
	const backup = await redis.get<Backup>(HOME_KEYS.BACKUP).catch(() => null);
	const onDisk = snapshotFiles(dir).at(-1);
	if (!backup && !onDisk) {
		throw new Error("No snapshot in Redis or on disk");
	}
	if (existsSync(databasePath)) {
		renameSync(databasePath, `${databasePath}.before-restore`);
	}
	if (backup) {
		writeFileSync(
			databasePath,
			gunzipSync(Buffer.from(backup.database, "base64")),
		);
		return `Redis, taken ${backup.takenAt}`;
	}
	copyFileSync(onDisk as string, databasePath);
	return onDisk as string;
}
