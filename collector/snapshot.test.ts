import {
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { HOME_KEYS } from "@/lib/home/status";
import { openDatabase } from "./db";
import type { HomeRedis } from "./redis";
import { restore, snapshotJob, takeSnapshot } from "./snapshot";

const T0 = new Date("2026-11-18T16:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

function fakeRedis(): HomeRedis & { keys: Map<string, unknown> } {
	const keys = new Map<string, unknown>();
	return {
		keys,
		get: async <T>(key: string) => (keys.get(key) as T | undefined) ?? null,
		set: async (key, value) => {
			keys.set(key, value);
		},
		del: async (key) => {
			keys.delete(key);
		},
	};
}

function workspace() {
	const home = mkdtempSync(path.join(tmpdir(), "collector-"));
	const databasePath = path.join(home, "collector.db");
	const db = openDatabase(databasePath);
	return { home, databasePath, db, dir: path.join(home, "snapshots") };
}

function note(db: ReturnType<typeof openDatabase>, value: string): void {
	db.prepare(
		`INSERT INTO meta (key, value) VALUES ('note', ?)
		 ON CONFLICT (key) DO UPDATE SET value = excluded.value`,
	).run(value);
}

function readNote(databasePath: string): unknown {
	const db = openDatabase(databasePath);
	const row = db.prepare("SELECT value FROM meta WHERE key = 'note'").get();
	db.close();
	return row?.value;
}

describe("the snapshot", () => {
	it("keeps the last 14 on disk", () => {
		const { db, dir } = workspace();
		for (let night = 0; night < 16; night += 1) {
			takeSnapshot(db, dir, new Date(T0.getTime() + night * DAY));
		}
		const files = readdirSync(dir).sort();
		expect(files).toHaveLength(14);
		expect(files[0]).toBe("collector-2026-11-20T16-00-00-000Z.db");
		expect(files.at(-1)).toBe("collector-2026-12-03T16-00-00-000Z.db");
	});

	it("stores the newest in home:backup, and restore rebuilds the record from it", async () => {
		const { db, dir, databasePath } = workspace();
		const redis = fakeRedis();
		note(db, "as snapshotted");
		await snapshotJob({ db, dir, redis }).run(T0);
		note(db, "written after the snapshot");
		db.close();

		const from = await restore({ databasePath, dir, redis });
		expect(from).toBe("Redis, taken 2026-11-18T16:00:00.000Z");
		expect(readNote(databasePath)).toBe("as snapshotted");
		// What was replaced is kept
		expect(readNote(`${databasePath}.before-restore`)).toBe(
			"written after the snapshot",
		);
	});

	it("restores from the newest on disk when Redis has no snapshot", async () => {
		const { db, dir, databasePath } = workspace();
		note(db, "first night");
		takeSnapshot(db, dir, T0);
		note(db, "second night");
		takeSnapshot(db, dir, new Date(T0.getTime() + DAY));
		note(db, "later");
		db.close();

		const redis = fakeRedis();
		redis.get = async () => {
			throw new Error("fetch failed");
		};
		await restore({ databasePath, dir, redis });
		expect(readNote(databasePath)).toBe("second night");
	});

	it("restores from disk when its newest snapshot is later than the one in Redis", async () => {
		const { db, dir, databasePath } = workspace();
		const redis = fakeRedis();
		note(db, "in Redis");
		await snapshotJob({ db, dir, redis }).run(T0);
		note(db, "on disk only");
		takeSnapshot(db, dir, new Date(T0.getTime() + DAY));
		db.close();
		await restore({ databasePath, dir, redis });
		expect(readNote(databasePath)).toBe("on disk only");
	});

	it("restores the owner's text files the record holds, keeping what it replaces", async () => {
		const { db, dir, databasePath, home } = workspace();
		const redis = fakeRedis();
		db.prepare("INSERT INTO files (path, content) VALUES (?, ?)").run(
			"also-consumed/game.txt",
			"Hades II\n",
		);
		db.prepare("INSERT INTO files (path, content) VALUES (?, ?)").run(
			"also-consumed/movie.txt",
			"Heat (1995)\n",
		);
		await snapshotJob({ db, dir, redis }).run(T0);
		db.close();
		mkdirSync(path.join(home, "also-consumed"));
		writeFileSync(
			path.join(home, "also-consumed", "game.txt"),
			"Edited since\n",
		);

		await restore({ databasePath, dir, redis, filesDir: home });
		const file = (name: string) =>
			readFileSync(path.join(home, "also-consumed", name), "utf8");
		expect(file("game.txt")).toBe("Hades II\n");
		expect(file("game.txt.before-restore")).toBe("Edited since\n");
		expect(file("movie.txt")).toBe("Heat (1995)\n");
	});

	it("has nothing to restore from when there is no snapshot anywhere", async () => {
		const { db, dir, databasePath } = workspace();
		db.close();
		await expect(
			restore({ databasePath, dir, redis: fakeRedis() }),
		).rejects.toThrow("No snapshot in Redis or on disk");
		expect(fakeRedis().keys.has(HOME_KEYS.BACKUP)).toBe(false);
	});
});
