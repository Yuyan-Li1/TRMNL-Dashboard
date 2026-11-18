import { describe, expect, it } from "vitest";
import type { SendResult } from "@/lib/alerts/alerts";
import { REFRESH_STATUS_KEY } from "@/lib/health/status";
import { HOME_KEYS, type HomeStatus } from "@/lib/home/status";
import { openDatabase } from "./db";
import { dailyAt, everyHours, type Job } from "./jobs";
import type { HomeRedis } from "./redis";
import { runTick, type TickOptions } from "./tick";

const T0 = new Date("2026-11-18T01:00:00Z"); // midday on the 18th in Sydney
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

function after(ms: number): Date {
	return new Date(T0.getTime() + ms);
}

/** Redis as a map, which can be made unreachable. */
function fakeRedis() {
	const keys = new Map<string, unknown>();
	const state = { reachable: true };
	function reach(): void {
		if (!state.reachable) {
			throw new Error("fetch failed");
		}
	}
	const redis: HomeRedis = {
		get: async <T>(key: string) => {
			reach();
			return (keys.get(key) as T | undefined) ?? null;
		},
		set: async (key, value) => {
			reach();
			keys.set(key, value);
		},
		del: async (key) => {
			reach();
			keys.delete(key);
		},
	};
	return { redis, keys, state };
}

/** A home server with a fresh Vercel refresh, no jobs, and Telegram working. */
function home() {
	const { redis, keys, state } = fakeRedis();
	const sent: string[] = [];
	const world = {
		db: openDatabase(":memory:"),
		redis,
		keys,
		redisState: state,
		sent,
		refreshCalls: 0,
		refreshWorks: true,
		telegram: { ok: true } as SendResult,
		refreshedAt(at: Date): void {
			keys.set(REFRESH_STATUS_KEY, {
				lastSuccessAt: at.toISOString(),
				sources: {},
			});
		},
		tick(now: Date, options: Partial<TickOptions> = {}) {
			return runTick({
				db: world.db,
				redis,
				jobs: [],
				now,
				commit: "abc1234",
				refresh: async () => {
					world.refreshCalls += 1;
					if (!world.refreshWorks) {
						throw new Error("Refresh answered 500");
					}
				},
				send: async (text) => {
					if (world.telegram.ok) {
						sent.push(text);
					}
					return world.telegram;
				},
				...options,
			});
		},
		status(): HomeStatus {
			return keys.get(HOME_KEYS.STATUS) as HomeStatus;
		},
	};
	world.refreshedAt(T0);
	return world;
}

function job(overrides: Partial<Job> & { runs?: Date[] } = {}): Job {
	return {
		name: "goodreads",
		isDue: everyHours(6),
		run: async (now) => {
			overrides.runs?.push(now);
		},
		...overrides,
	};
}

describe("runTick", () => {
	it("writes the heartbeat, the commit and every job to home:status", async () => {
		const world = home();
		await world.tick(T0);
		expect(world.status()).toEqual({
			heartbeatAt: T0.toISOString(),
			commit: "abc1234",
			jobs: {
				goodreads: { failuresInARow: 0 },
				"code-update": { failuresInARow: 0 },
				snapshot: { failuresInARow: 0 },
			},
		});
		expect(world.sent).toEqual([]);
	});

	it("runs a job when it is due and records the attempt and the success", async () => {
		const world = home();
		const runs: Date[] = [];
		const jobs = [job({ runs })];
		await world.tick(T0, { jobs });
		await world.tick(after(15 * MINUTE), { jobs });
		expect(runs).toEqual([T0]);
		expect(world.status().jobs.goodreads).toEqual({
			lastAttemptAt: T0.toISOString(),
			lastSuccessAt: T0.toISOString(),
			failuresInARow: 0,
		});
		// The tick six hours on starts a second or two early
		await world.tick(after(6 * HOUR - 2000), { jobs });
		expect(runs).toHaveLength(2);
	});

	it("runs a daily job once the owner's clock passes its time", async () => {
		const world = home();
		const runs: Date[] = [];
		const jobs = [job({ name: "code-update", isDue: dailyAt("03:30"), runs })];
		// Never tried: due at once. Midday on the 18th in Sydney.
		await world.tick(T0, { jobs });
		// 03:15 on the 19th in Sydney: not yet
		const quarterPast = new Date("2026-11-18T16:15:00Z");
		world.refreshedAt(quarterPast);
		await world.tick(quarterPast, { jobs });
		expect(runs).toHaveLength(1);
		// 03:30 on the 19th
		const halfPast = new Date("2026-11-18T16:30:00Z");
		await world.tick(halfPast, { jobs });
		await world.tick(new Date("2026-11-18T16:45:00Z"), { jobs });
		expect(runs).toEqual([T0, halfPast]);
	});

	it("counts a job's failures in a row and alerts on the second for Goodreads", async () => {
		const world = home();
		const failing = [
			job({
				run: async () => {
					throw new Error("Goodreads answered 503");
				},
			}),
		];
		await world.tick(T0, { jobs: failing });
		expect(world.sent).toEqual([]);
		const later = after(6 * HOUR);
		world.refreshedAt(later);
		await world.tick(later, { jobs: failing });
		expect(world.status().jobs.goodreads).toEqual({
			lastAttemptAt: later.toISOString(),
			failuresInARow: 2,
			failingSince: T0.toISOString(),
			lastError: "Error: Goodreads answered 503",
		});
		expect(world.sent).toEqual([
			"[home] Goodreads read failing since 18 Nov 12:00.",
		]);

		const recovered = after(12 * HOUR);
		world.refreshedAt(recovered);
		await world.tick(recovered, { jobs: [job()] });
		expect(world.sent[1]).toBe(
			"[home] Goodreads read recovered after 12 hours",
		);
	});

	it("alerts on the first failed code update", async () => {
		const world = home();
		await world.tick(T0, {
			jobs: [
				job({
					name: "code-update",
					run: async () => {
						throw new Error("git pull failed");
					},
				}),
			],
		});
		expect(world.sent).toEqual([
			"[home] Code update failing since 18 Nov 12:00.",
		]);
	});

	it("leaves the Vercel refresh alone while its last success is under 30 minutes old", async () => {
		const world = home();
		await world.tick(after(29 * MINUTE));
		expect(world.refreshCalls).toBe(0);
	});

	it("calls the refresh itself once the last success is over 30 minutes old", async () => {
		const world = home();
		await world.tick(after(31 * MINUTE));
		expect(world.refreshCalls).toBe(1);
		expect(world.sent).toEqual([]);
	});

	it("alerts that the Vercel refresh is Stale after an hour, unless its own call works", async () => {
		const world = home();
		world.refreshWorks = false;
		await world.tick(after(45 * MINUTE));
		expect(world.sent).toEqual([]);
		await world.tick(after(61 * MINUTE));
		expect(world.sent).toEqual([
			"[home] Vercel refresh Stale since 18 Nov 12:00.",
		]);
		// A day off, the home server comes back and its own call runs through
		world.refreshWorks = true;
		await world.tick(after(90 * MINUTE));
		expect(world.sent[1]).toBe("[home] Vercel refresh recovered after 1 hour");
	});

	it("still alerts when Redis is unreachable, once, and runs its jobs", async () => {
		const world = home();
		const runs: Date[] = [];
		world.redisState.reachable = false;
		await world.tick(T0, { jobs: [job({ runs })] });
		await world.tick(after(15 * MINUTE));
		expect(runs).toEqual([T0]);
		expect(world.sent).toEqual([
			"[home] Redis unreachable since 18 Nov 12:00.",
		]);

		world.redisState.reachable = true;
		await world.tick(after(30 * MINUTE));
		expect(world.sent[1]).toBe("[home] Redis recovered after 30 minutes");
		expect(world.status().heartbeatAt).toBe(after(30 * MINUTE).toISOString());
	});

	it("sends again on the next tick a message Telegram did not take", async () => {
		const world = home();
		world.redisState.reachable = false;
		world.telegram = { ok: false, error: "Telegram answered 502" };
		const alerts = await world.tick(T0);
		expect(alerts).toMatchObject([{ label: "Redis", ok: false }]);
		world.telegram = { ok: true };
		await world.tick(after(15 * MINUTE));
		expect(world.sent).toEqual([
			"[home] Redis unreachable since 18 Nov 12:00.",
		]);
	});

	it("dates the Claude Code token a year from the day it is first seen or changes", async () => {
		const world = home();
		await world.tick(T0, { claudeToken: "token-one" });
		expect(world.status().claudeTokenExpiresOn).toBe("2027-11-18");
		// 20:00 UTC on 1 March is already the 2nd in Sydney
		const march = new Date("2027-03-01T20:00:00Z");
		world.refreshedAt(march);
		await world.tick(march, { claudeToken: "token-one" });
		expect(world.status().claudeTokenExpiresOn).toBe("2027-11-18");
		await world.tick(march, { claudeToken: "token-two" });
		expect(world.status().claudeTokenExpiresOn).toBe("2028-03-01");
	});

	it("warns 14 and 3 days before the Claude Code token expires", async () => {
		const world = home();
		await world.tick(T0, { claudeToken: "token-one" });
		for (const day of [
			"2027-11-03",
			"2027-11-04",
			"2027-11-10",
			"2027-11-15",
		]) {
			const now = new Date(`${day}T01:00:00Z`);
			world.refreshedAt(now);
			await world.tick(now, { claudeToken: "token-one" });
		}
		expect(world.sent.map((text) => text.split("\n")[0])).toEqual([
			"[home] Claude Code token expires within 14 days, on 18 Nov 2027.",
			"[home] Claude Code token expires within 3 days, on 18 Nov 2027.",
		]);
		expect(world.sent[0]).toContain("Fix: run `claude setup-token`");
	});

	it("publishes after the jobs, and not when Redis is unreachable", async () => {
		const world = home();
		let published = 0;
		const publish = async (): Promise<void> => {
			published += 1;
		};
		await world.tick(T0, { publish });
		world.redisState.reachable = false;
		await world.tick(after(15 * MINUTE), { publish });
		expect(published).toBe(1);
	});
});
