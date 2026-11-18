import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { promisify } from "node:util";
import { dailyAt, type Job } from "./jobs";

const COMMAND_TIMEOUT_MS = 10 * 60 * 1000;

/** Run a command in a folder and give back what it printed. */
export type Exec = (
	command: string,
	args: string[],
	cwd: string,
) => Promise<string>;

export const exec: Exec = async (command, args, cwd) => {
	const { stdout } = await promisify(execFile)(command, args, {
		cwd,
		timeout: COMMAND_TIMEOUT_MS,
	});
	return stdout.trim();
};

function lockfileHash(repoDir: string): string {
	return createHash("sha256")
		.update(readFileSync(path.join(repoDir, "pnpm-lock.yaml")))
		.digest("hex");
}

/**
 * The daily code update: pull `main`, fast-forward only, and reinstall
 * dependencies if the lockfile changed. A pull that fails changes nothing,
 * so the old code keeps running; the job's failure raises the Alert. The
 * tick that pulled goes on with the code it started with.
 */
export function codeUpdateJob(options: { repoDir: string; exec: Exec }): Job {
	const { repoDir, exec } = options;
	return {
		name: "code-update",
		isDue: dailyAt("03:30"),
		run: async () => {
			const before = lockfileHash(repoDir);
			await exec("git", ["pull", "--ff-only", "origin", "main"], repoDir);
			if (lockfileHash(repoDir) !== before) {
				await exec("pnpm", ["install", "--frozen-lockfile"], repoDir);
			}
		},
	};
}
