import { formatMoment, type SentAlert } from "@/lib/alerts/alerts";
import { OWNER_TIME_ZONE } from "@/lib/config";
import { type HomeStatus, JOB_LABELS, JOB_NAMES } from "@/lib/home/status";
import { readLastSend } from "./alert";
import { formatDay } from "./checks";
import { isHeartbeatStale, readHomeStatus } from "./home";
import { SOURCE_IDS, SOURCES } from "./sources";
import { isStale, type RefreshStatus, readRefreshStatus } from "./status";

/**
 * What the status strip shows: times and names only. It is public, so no
 * error text, and of tokens only the day the Claude Code token expires.
 */
export interface StatusStripView {
	sources: { name: string; lastGoodRead: string; stale: boolean }[];
	lastRefresh: string;
	lastAlert: { label: string; at: string; sent: boolean } | null;
	/** The home server, once the Collector has ticked */
	home: {
		heartbeat: string;
		stale: boolean;
		/** A job is Stale while its runs are failing */
		jobs: { name: string; lastSuccess: string; stale: boolean }[];
		/** "18 Nov 2027" */
		claudeTokenExpires?: string;
	} | null;
}

/** A moment in the owner's time zone, or "never" for one that has not come. */
export function formatWhenOrNever(at: string | undefined): string {
	return at ? formatMoment(at, OWNER_TIME_ZONE) : "never";
}

export function statusStripView(
	status: RefreshStatus | null,
	lastSend: SentAlert | null,
	now: Date,
	home: HomeStatus | null = null,
): StatusStripView {
	return {
		sources: SOURCE_IDS.map((id) => {
			const health = status?.sources[id];
			return {
				name: SOURCES[id].name,
				lastGoodRead: formatWhenOrNever(health?.lastGoodReadAt),
				stale: isStale(id, health, now),
			};
		}),
		lastRefresh: formatWhenOrNever(status?.lastSuccessAt),
		lastAlert: lastSend
			? {
					label: lastSend.label,
					at: formatWhenOrNever(lastSend.at),
					sent: lastSend.ok,
				}
			: null,
		home: home
			? {
					heartbeat: formatWhenOrNever(home.heartbeatAt),
					stale: isHeartbeatStale(home, now),
					jobs: JOB_NAMES.map((name) => ({
						name: JOB_LABELS[name],
						lastSuccess: formatWhenOrNever(home.jobs[name]?.lastSuccessAt),
						stale: (home.jobs[name]?.failuresInARow ?? 0) > 0,
					})),
					...(home.claudeTokenExpiresOn && {
						claudeTokenExpires: formatDay(home.claudeTokenExpiresOn),
					}),
				}
			: null,
	};
}

/** Read the status strip from Redis. */
export async function loadStatusStrip(): Promise<StatusStripView> {
	const [status, lastSend, home] = await Promise.all([
		readRefreshStatus(),
		readLastSend(),
		readHomeStatus(),
	]);
	return statusStripView(status, lastSend, new Date(), home);
}
