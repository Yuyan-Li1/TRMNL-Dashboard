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
import { type Database, openDatabase } from "./db";
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

/** When a snapshot file was taken, from its name. */
function takenAt(file: string): string {
	// `collector-2026-11-18T01-00-00-000Z.db` back to an ISO time
	return path
		.basename(file, ".db")
		.slice("collector-".length)
		.replace(/T(\d+)-(\d+)-(\d+)-(\d+)Z$/, "T$1:$2:$3.$4Z");
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
	const backup: Backup = {
		takenAt: takenAt(newest),
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
 * Rebuild the record from the snapshot in Redis or the newest on disk,
 * whichever was taken later; from disk when Redis has none or cannot be
 * reached. The record being replaced is kept beside it as
 * `.before-restore`. With `filesDir`, the owner's text files the record
 * holds (the "also consumed" files) are written back under it, each file
 * that differs kept the same way. Returns where the snapshot came from.
 */
export async function restore(options: {
	databasePath: string;
	dir: string;
	redis: HomeRedis;
	/** The Collector's folder, which the text files are relative to */
	filesDir?: string;
}): Promise<string> {
	const { databasePath, dir, redis, filesDir } = options;
	const backup = await redis.get<Backup>(HOME_KEYS.BACKUP).catch(() => null);
	const onDisk = snapshotFiles(dir).at(-1);
	if (!backup && !onDisk) {
		throw new Error("No snapshot in Redis or on disk");
	}
	if (existsSync(databasePath)) {
		renameSync(databasePath, `${databasePath}.before-restore`);
	}
	let from: string;
	if (backup && !(onDisk && takenAt(onDisk) > backup.takenAt)) {
		writeFileSync(
			databasePath,
			gunzipSync(Buffer.from(backup.database, "base64")),
		);
		from = `Redis, taken ${backup.takenAt}`;
	} else {
		copyFileSync(onDisk as string, databasePath);
		from = onDisk as string;
	}
	if (filesDir) {
		restoreFiles(databasePath, filesDir);
	}
	return from;
}

/** Write the text files a restored record holds back to disk. */
function restoreFiles(databasePath: string, filesDir: string): void {
	const db = openDatabase(databasePath);
	const files = db.prepare("SELECT path, content FROM files").all() as {
		path: string;
		content: string;
	}[];
	db.close();
	for (const { path: relative, content } of files) {
		const file = path.join(filesDir, relative);
		if (existsSync(file)) {
			if (readFileSync(file, "utf8") === content) {
				continue;
			}
			renameSync(file, `${file}.before-restore`);
		}
		mkdirSync(path.dirname(file), { recursive: true });
		writeFileSync(file, content);
	}
}
