import { createHash } from "node:crypto";
import type { Check } from "@/lib/alerts/alerts";
import { expiryAlert } from "@/lib/health/checks";
import {
	type HomeJobStatus,
	JOB_LABELS,
	type JobName,
} from "@/lib/home/status";
import type { UnmatchedLine } from "./consumed/sets";

/** Who is speaking in the Collector's Alerts, and the start of its failures' ids. */
export const SENDER = "home";

/**
 * A job alerts after this many failed runs in a row. Goodreads is read every
 * 6 hours, so two failures are 12 hours; the consumed set is merged every
 * tick, so four are 1 hour; a failed code update alerts at once. The
 * snapshot does not alert: it shows on the source health page.
 */
const FAILED_RUNS_BEFORE_ALERT: Partial<Record<JobName, number>> = {
	goodreads: 2,
	consumed: 4,
	"code-update": 1,
};

/** The start of the id of every unmatched line's Alert. */
export const UNMATCHED_LINE_PREFIX = `${SENDER}:also-consumed:`;

/** The id of one unmatched line's Alert. The line itself is kept out of it. */
function unmatchedLineId({ medium, line }: UnmatchedLine): string {
	const hash = createHash("sha1").update(line).digest("hex").slice(0, 12);
	return `${UNMATCHED_LINE_PREFIX}${medium}:${hash}`;
}

const CLAUDE_TOKEN_FIX =
	"run `claude setup-token` on the home server and put the result in ~/trmnl-collector/.env as CLAUDE_CODE_OAUTH_TOKEN.";

/** What one tick saw. */
export interface TickFindings {
	redisReachable: boolean;
	/**
	 * Whether the Vercel refresh is Stale, and since when. Undefined when the
	 * tick could not tell, so the failure's state is left as it was.
	 */
	refresh?: { stale: boolean; lastSuccessAt?: string };
	jobs: Record<JobName, HomeJobStatus>;
	claudeTokenExpiresOn?: string;
	/** The lines of the "also consumed" files that no Catalog could match */
	unmatchedLines?: UnmatchedLine[];
	/**
	 * The ids of the unmatched lines' Alerts that are remembered, so the
	 * Alert of a line that has since been edited or removed is forgotten
	 */
	rememberedLineAlerts?: string[];
}

/** What the Collector alerts on, judged from one tick. */
export function homeChecks(findings: TickFindings, now: Date): Check[] {
	const checks: Check[] = [
		{
			id: `${SENDER}:redis`,
			label: "Redis",
			failure: findings.redisReachable ? null : { what: "Redis unreachable" },
		},
	];
	if (findings.refresh) {
		const { stale, lastSuccessAt } = findings.refresh;
		checks.push({
			id: `${SENDER}:vercel-refresh`,
			label: "Vercel refresh",
			failure: stale
				? { what: "Vercel refresh Stale", since: lastSuccessAt }
				: null,
		});
	}
	for (const [name, threshold] of Object.entries(FAILED_RUNS_BEFORE_ALERT)) {
		const job = findings.jobs[name as JobName];
		const label = JOB_LABELS[name as JobName];
		checks.push({
			id: `${SENDER}:${name}`,
			label,
			failure:
				job.failuresInARow >= threshold
					? { what: `${label} failing`, since: job.failingSince }
					: null,
		});
	}
	// One Alert per line, sent once when the line is first unmatched. Editing
	// or removing the line clears it without a word.
	const unmatched = new Set<string>();
	for (const entry of findings.unmatchedLines ?? []) {
		const file = `also-consumed/${entry.medium}.txt`;
		const id = unmatchedLineId(entry);
		unmatched.add(id);
		checks.push({
			id,
			label: file,
			failure: {
				what: `No match for "${entry.line}" in ${file}`,
				fix: `edit the line in ~/trmnl-collector/${file}: correct the title, or add ${
					entry.medium === "book" ? "the author" : "the year"
				} in brackets.`,
			},
			oneOff: true,
		});
	}
	for (const id of findings.rememberedLineAlerts ?? []) {
		if (!unmatched.has(id)) {
			checks.push({ id, label: "also-consumed", failure: null, oneOff: true });
		}
	}
	const expiring =
		findings.claudeTokenExpiresOn &&
		expiryAlert("Claude Code token", findings.claudeTokenExpiresOn, now);
	checks.push({
		id: `${SENDER}:claude-token-expiry`,
		label: "Claude Code token",
		failure: expiring ? { what: expiring, fix: CLAUDE_TOKEN_FIX } : null,
		oneOff: true,
	});
	return checks;
}
