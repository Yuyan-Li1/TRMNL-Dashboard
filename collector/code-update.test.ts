import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { codeUpdateJob, type Exec } from "./code-update";

/** A checkout whose pull brings in the given lockfile, or fails. */
function checkout(pulled: string | Error) {
	const repoDir = mkdtempSync(path.join(tmpdir(), "repo-"));
	const lockfile = path.join(repoDir, "pnpm-lock.yaml");
	writeFileSync(lockfile, "lockfile: 1");
	const commands: string[] = [];
	const exec: Exec = async (command, args) => {
		commands.push([command, ...args].join(" "));
		if (command === "git") {
			if (pulled instanceof Error) {
				throw pulled;
			}
			writeFileSync(lockfile, pulled);
		}
		return "";
	};
	return { job: codeUpdateJob({ repoDir, exec }), commands };
}

describe("the code update", () => {
	it("pulls main, fast-forward only", async () => {
		const { job, commands } = checkout("lockfile: 1");
		await job.run(new Date());
		expect(commands).toEqual(["git pull --ff-only origin main"]);
	});

	it("reinstalls dependencies when the lockfile changed", async () => {
		const { job, commands } = checkout("lockfile: 2");
		await job.run(new Date());
		expect(commands).toEqual([
			"git pull --ff-only origin main",
			"pnpm install --frozen-lockfile",
		]);
	});

	it("fails when the pull fails, and installs nothing", async () => {
		const { job, commands } = checkout(
			new Error("Not possible to fast-forward"),
		);
		await expect(job.run(new Date())).rejects.toThrow("fast-forward");
		expect(commands).toHaveLength(1);
	});
});
