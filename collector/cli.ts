import { existsSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import type { SendResult } from "@/lib/alerts/alerts";
import { sendTelegramMessage } from "@/lib/alerts/telegram";
import { HOME_KEYS, JOB_NAMES } from "@/lib/home/status";
import { SENDER } from "./checks";
import { codeUpdateJob, exec } from "./code-update";
import { catalogs } from "./consumed/catalogs";
import { consumedJob } from "./consumed/merge";
import { seedConsumed } from "./consumed/seed";
import { publishConsumed } from "./consumed/sets";
import { type Database, openDatabase } from "./db";
import { goodreadsJob, publishBooks } from "./goodreads/read";
import { type Job, runJob } from "./jobs";
import { connectRedis, type HomeRedis } from "./redis";
import { publishBackup, restore, snapshotJob } from "./snapshot";
import { homeStatus, runTick, type TickOptions } from "./tick";

/**
 * The Collector's commands. `tick` is started by launchd every 15 minutes;
 * the rest are run by hand on the home server.
 */
const USAGE = `Usage: collector <command>

  tick          Write the heartbeat, check the Vercel refresh, run the jobs
                that are due and send Alerts. Started by launchd.
  publish       Rewrite every home: key from SQLite.
  restore       Rebuild SQLite and the also-consumed files from the snapshot
                in Redis or on disk.
  seed          Load the Letterboxd and Goodreads exports in
                ~/trmnl-collector/exports/ into SQLite. One-off; safe to run
                twice.
  test-alert    Send a test Alert.
  run <job>     Run one job now, ignoring its schedule: ${JOB_NAMES.join(", ")}.`;

const COMMANDS: readonly string[] = [
	"tick",
	"publish",
	"restore",
	"seed",
	"test-alert",
	"run",
] as const;

const REFRESH_TIMEOUT_MS = 90_000;

/** Where the Collector keeps its `.env`, its record, snapshots and logs. */
const HOME_DIR =
	process.env.COLLECTOR_HOME ?? path.join(homedir(), "trmnl-collector");
const DATABASE_PATH = path.join(HOME_DIR, "collector.db");
const SNAPSHOT_DIR = path.join(HOME_DIR, "snapshots");
const EXPORTS_DIR = path.join(HOME_DIR, "exports");
const ALSO_CONSUMED_DIR = path.join(HOME_DIR, "also-consumed");
const REPO_DIR = path.resolve(import.meta.dirname, "..");

function env(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(`${name} is not set in ${path.join(HOME_DIR, ".env")}`);
	}
	return value;
}

function redis(): HomeRedis {
	return connectRedis(
		env("UPSTASH_REDIS_REST_URL"),
		env("UPSTASH_REDIS_REST_TOKEN"),
	);
}

function send(text: string): Promise<SendResult> {
	return sendTelegramMessage(text, {
		botToken: process.env.TELEGRAM_BOT_TOKEN,
		chatId: process.env.TELEGRAM_CHAT_ID,
	});
}

/** Ask Vercel to refresh, as GitHub Actions does. */
async function refresh(): Promise<void> {
	const origin = env("DASHBOARD_URL").replace(/\/$/, "");
	const response = await fetch(`${origin}/api/refresh`, {
		method: "POST",
		headers: { Authorization: `Bearer ${env("CRON_SECRET")}` },
		signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
	});
	if (!response.ok) {
		throw new Error(`Refresh answered ${response.status}`);
	}
}

/** The Collector's jobs, in the order a tick runs them. */
function jobs(db: Database, store: HomeRedis): Job[] {
	return [
		goodreadsJob({ db, userId: env("GOODREADS_USER_ID") }),
		// After Goodreads, so a book read today is in the set this tick
		consumedJob({
			db,
			redis: store,
			alsoConsumedDir: ALSO_CONSUMED_DIR,
			findInCatalog: catalogs(db),
		}),
		snapshotJob({ db, dir: SNAPSHOT_DIR, redis: store }),
		// Last, so nothing else in the tick runs after the code has changed
		codeUpdateJob({ repoDir: REPO_DIR, exec }),
	];
}

/** Rewrite what the Collector publishes besides its status and its backup. */
async function publish(
	db: Database,
	store: HomeRedis,
	now: Date,
): Promise<void> {
	await publishBooks(db, store);
	await publishConsumed(db, store, now);
}

async function statusOptions(): Promise<
	Pick<TickOptions, "now" | "commit" | "claudeToken">
> {
	return {
		now: new Date(),
		commit: await exec("git", ["rev-parse", "--short", "HEAD"], REPO_DIR),
		claudeToken: process.env.CLAUDE_CODE_OAUTH_TOKEN,
	};
}

async function main(): Promise<void> {
	const [command, argument] = process.argv.slice(2);
	if (!command || !COMMANDS.includes(command)) {
		console.log(USAGE);
		process.exitCode = command ? 1 : 0;
		return;
	}
	const envFile = path.join(HOME_DIR, ".env");
	if (existsSync(envFile)) {
		process.loadEnvFile(envFile);
	}
	// It would be used in place of the subscription token by any `claude` run
	delete process.env.ANTHROPIC_API_KEY;
	mkdirSync(HOME_DIR, { recursive: true, mode: 0o700 });

	if (command === "test-alert") {
		const result = await send(`[${SENDER}] Test Alert from the Collector.`);
		if (!result.ok) {
			throw new Error(`Test Alert not sent: ${result.error}`);
		}
		console.log("Test Alert sent.");
		return;
	}
	if (command === "restore") {
		const from = await restore({
			databasePath: DATABASE_PATH,
			dir: SNAPSHOT_DIR,
			redis: redis(),
			filesDir: HOME_DIR,
		});
		console.log(`Restored ${DATABASE_PATH} from ${from}.`);
		return;
	}

	const db = openDatabase(DATABASE_PATH);
	if (command === "seed") {
		const { movies, books } = seedConsumed(db, EXPORTS_DIR, new Date());
		console.log(
			`Seeded ${movies} movies and ${books} read books. The next tick publishes the consumed set.`,
		);
		return;
	}
	const store = redis();
	if (command === "tick") {
		const options = await statusOptions();
		const alerts = await runTick({
			db,
			redis: store,
			jobs: jobs(db, store),
			refresh,
			send,
			publish: () => publish(db, store, options.now),
			...options,
		});
		console.log(
			`${options.now.toISOString()} tick at ${options.commit}: ${alerts.length} Alert(s)`,
		);
	} else if (command === "publish") {
		const options = await statusOptions();
		await store.set(HOME_KEYS.STATUS, homeStatus(db, options));
		await publish(db, store, options.now);
		await publishBackup(SNAPSHOT_DIR, store);
		console.log("Published every home: key.");
	} else {
		const job = jobs(db, store).find((entry) => entry.name === argument);
		if (!job) {
			throw new Error(`No job named "${argument ?? ""}".\n\n${USAGE}`);
		}
		const options = await statusOptions();
		await runJob(db, job, options.now);
		const status = homeStatus(db, options);
		await store.set(HOME_KEYS.STATUS, status);
		await publish(db, store, options.now);
		const { lastError } = status.jobs[job.name];
		if (lastError) {
			throw new Error(`${job.name} failed: ${lastError}`);
		}
		console.log(`${job.name} ran.`);
	}
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : error);
	process.exitCode = 1;
});
